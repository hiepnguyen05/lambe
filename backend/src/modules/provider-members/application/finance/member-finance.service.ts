import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ServiceOrder } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  FinanceRangeDto,
  FinanceOrdersQueryDto,
  FinanceMembersQueryDto,
  OwnerFinanceQueryDto,
  OwnerFinanceOrdersQueryDto,
} from '../../dto/member-finance.dto';
import {
  financeCohort,
  financeNumber,
  netOrderProceeds,
  financeTotalsSql,
  presentFinanceTotals,
  type FinanceScope,
  type FinanceRange,
  type FinanceTotalsRow,
} from './member-finance.queries';

type Tx = Prisma.TransactionClient;
type OrderRow = Pick<
  ServiceOrder,
  | 'id'
  | 'assignedMemberId'
  | 'assignedMemberVersion'
  | 'assignedMemberName'
  | 'assignedMemberAvatarUrl'
  | 'assignedMemberUserId'
  | 'serviceName'
  | 'completedAt'
  | 'cashCollectedAt'
  | 'cashCollectedByUserId'
  | 'cashCollectedAmount'
  | 'servicePriceAmount'
  | 'travelFeeAmount'
  | 'discountAmount'
  | 'platformFundedAmount'
  | 'providerFundedAmount'
  | 'totalAmount'
  | 'commissionAmount'
  | 'currencyCode'
> & { commissionChargedAmount: bigint; platformReimbursedAmount: bigint };
type GroupRow = FinanceTotalsRow & {
  groupKey: string;
  assignedMemberId: string | null;
  assignedMemberVersion: number | null;
  displayName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class MemberFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  ownerSummary(userId: string, query: OwnerFinanceQueryDto) {
    return this.read(
      userId,
      query,
      undefined,
      query.memberId,
      async (tx, scope, range) => {
        const totals = await this.totals(tx, scope, range);
        const wallet = await tx.providerWallet.findUnique({
          where: { providerId: scope.providerId },
          select: { balanceAmount: true, heldAmount: true, currencyCode: true },
        });
        if (!wallet || wallet.currencyCode !== 'VND')
          throw new ConflictException('Ví tổ chức cần được hỗ trợ kiểm tra.');
        const openScope: Prisma.ServiceOrderWhereInput = {
          providerId: scope.providerId,
          ...(scope.memberId ? { assignedMemberId: scope.memberId } : {}),
        };
        const [holds, disputes] = await Promise.all([
          tx.walletHold.aggregate({
            where: { status: 'ACTIVE', order: openScope },
            _sum: { amount: true },
            _count: true,
          }),
          tx.serviceOrder.aggregate({
            where: {
              ...openScope,
              status: { in: ['PAYMENT_DISPUTE', 'DISPUTED'] },
            },
            _sum: { totalAmount: true },
            _count: true,
          }),
        ]);
        return {
          ...totals,
          organizationWalletNow: {
            ...wallet,
            availableAmount: wallet.balanceAmount - wallet.heldAmount,
          },
          outstandingNow: {
            activeHoldCount: holds._count,
            activeCommissionHoldAmount: financeNumber(holds._sum.amount ?? 0),
            paymentDisputeCount: disputes._count,
            disputedCustomerPayableAmount: financeNumber(
              disputes._sum.totalAmount ?? 0,
            ),
          },
        };
      },
    );
  }

  workerSummary(userId: string, memberId: string, query: FinanceRangeDto) {
    return this.read(
      userId,
      query,
      memberId,
      undefined,
      async (tx, scope, range) => {
        const totals = await this.totals(tx, scope, range);
        return {
          completedOrderCount: totals.completedOrderCount,
          customerPayableAmount: totals.customerPayableAmount,
          cashRecordedAmount: totals.cashRecordedAmount,
          cashRecordedOrderCount: totals.cashRecordedOrderCount,
          cashUnverifiedOrderCount: totals.cashUnverifiedOrderCount,
          cashUnverifiedPayableAmount: totals.cashUnverifiedPayableAmount,
          collectionPurpose: 'ON_BEHALF_OF_ORGANIZATION' as const,
        };
      },
    );
  }

  ownerMembers(userId: string, query: FinanceMembersQueryDto) {
    return this.read(
      userId,
      query,
      undefined,
      undefined,
      async (tx, scope, range) => {
        const groups = await tx.$queryRaw<
          GroupRow[]
        >(Prisma.sql`${financeCohort(scope, range)}
        SELECT "groupKey", "assignedMemberId", "assignedMemberVersion",
          (array_agg("assignedMemberName" ORDER BY "completedAt" DESC,"id" DESC))[1] AS "displayName",
          (array_agg("assignedMemberAvatarUrl" ORDER BY "completedAt" DESC,"id" DESC))[1] AS "avatarUrl",
          ${financeTotalsSql} FROM amounts
        ${query.cursor ? Prisma.sql`WHERE "groupKey">${query.cursor}` : Prisma.empty}
        GROUP BY "groupKey","assignedMemberId","assignedMemberVersion" ORDER BY "groupKey" LIMIT ${query.limit + 1}`);
        const page = groups.slice(0, query.limit);
        return {
          items: page.map(
            ({
              groupKey,
              assignedMemberId,
              assignedMemberVersion,
              displayName,
              avatarUrl,
              ...totals
            }) => ({
              groupKey,
              memberId: assignedMemberId,
              membershipVersion: assignedMemberVersion,
              displayName,
              avatarUrl,
              attribution: assignedMemberId
                ? 'ASSIGNED_MEMBER'
                : 'LEGACY_UNASSIGNED',
              ...presentFinanceTotals(totals),
            }),
          ),
          nextCursor:
            groups.length > query.limit ? page.at(-1)!.groupKey : null,
        };
      },
    );
  }

  ownerOrders(userId: string, query: OwnerFinanceOrdersQueryDto) {
    return this.read(
      userId,
      query,
      undefined,
      query.memberId,
      (tx, scope, range) => this.orders(tx, scope, range, query, true),
    );
  }

  workerOrders(userId: string, memberId: string, query: FinanceOrdersQueryDto) {
    return this.read(userId, query, memberId, undefined, (tx, scope, range) =>
      this.orders(tx, scope, range, query, false),
    );
  }

  private async totals(tx: Tx, scope: FinanceScope, range: FinanceRange) {
    const [row] = await tx.$queryRaw<FinanceTotalsRow[]>(
      Prisma.sql`${financeCohort(scope, range)} SELECT ${financeTotalsSql} FROM amounts`,
    );
    return presentFinanceTotals(row);
  }

  private async orders(
    tx: Tx,
    scope: FinanceScope,
    range: FinanceRange,
    query: FinanceOrdersQueryDto,
    owner: boolean,
  ) {
    let cursor: { id: string; completedAt: Date } | undefined;
    if (query.cursor) {
      [cursor] = await tx.$queryRaw<
        { id: string; completedAt: Date }[]
      >(Prisma.sql`${financeCohort(scope, range)}
        SELECT "id","completedAt" FROM completed WHERE "id"=${query.cursor}`);
      if (!cursor)
        throw new BadRequestException(
          'Cursor không thuộc báo cáo; hãy tải lại từ trang đầu.',
        );
    }
    const rows = await tx.$queryRaw<
      OrderRow[]
    >(Prisma.sql`${financeCohort(scope, range, { cursor, limit: query.limit + 1 })} SELECT * FROM amounts
      ORDER BY "completedAt" DESC,"id" DESC`);
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => {
        if (row.currencyCode !== 'VND')
          throw new ConflictException('Đơn khác tiền tệ; cần hỗ trợ đối soát.');
        return {
          orderId: row.id,
          serviceName: row.serviceName,
          completedAt: row.completedAt,
          currencyCode: row.currencyCode,
          assignedMember: row.assignedMemberId
            ? {
                id: row.assignedMemberId,
                membershipVersion: row.assignedMemberVersion,
                displayName: row.assignedMemberName,
                avatarUrl: row.assignedMemberAvatarUrl,
              }
            : null,
          customerPayableAmount: row.totalAmount,
          cashCollection: {
            status:
              row.cashCollectedAmount === null ? 'UNVERIFIED' : 'RECORDED',
            amount: row.cashCollectedAmount,
            collectedAt: row.cashCollectedAt,
            collectorMemberId:
              row.cashCollectedAmount !== null &&
              row.cashCollectedByUserId === row.assignedMemberUserId
                ? row.assignedMemberId
                : null,
          },
          ...(owner
            ? {
                servicePriceAmount: row.servicePriceAmount,
                serviceTotalAmount: financeNumber(
                  BigInt(row.totalAmount) +
                    BigInt(row.discountAmount) -
                    BigInt(row.travelFeeAmount),
                ),
                addOnPriceAmount: financeNumber(
                  BigInt(row.totalAmount) +
                    BigInt(row.discountAmount) -
                    BigInt(row.travelFeeAmount) -
                    BigInt(row.servicePriceAmount),
                ),
                travelFeeAmount: row.travelFeeAmount,
                discountAmount: row.discountAmount,
                platformFundedAmount: row.platformFundedAmount,
                providerFundedAmount: row.providerFundedAmount,
                expectedCommissionAmount: row.commissionAmount,
                commissionChargedAmount: financeNumber(
                  row.commissionChargedAmount,
                ),
                platformReimbursedAmount: financeNumber(
                  row.platformReimbursedAmount,
                ),
                netOrderProceedsAmount: netOrderProceeds(
                  row.totalAmount,
                  row.platformReimbursedAmount,
                  row.commissionChargedAmount,
                ),
              }
            : {}),
        };
      }),
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    };
  }

  private async read<T>(
    userId: string,
    query: FinanceRangeDto,
    selfMemberId: string | undefined,
    filterMemberId: string | undefined,
    report: (tx: Tx, scope: FinanceScope, range: FinanceRange) => Promise<T>,
  ) {
    const range = { from: new Date(query.from), to: new Date(query.to) };
    if (
      !Number.isFinite(range.from.getTime()) ||
      !Number.isFinite(range.to.getTime()) ||
      range.to <= range.from ||
      range.to.getTime() - range.from.getTime() > 93 * 86400000
    )
      throw new BadRequestException(
        'Khoảng completedAt phải tăng dần và không quá 93 ngày.',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        let scope: FinanceScope;
        if (selfMemberId) {
          const member = await tx.providerMember.findFirst({
            where: {
              id: selfMemberId,
              userId,
              provider: { providerType: 'ORGANIZATION' },
            },
            select: { providerId: true },
          });
          if (!member)
            throw new NotFoundException(
              'Không tìm thấy lịch sử thu hộ của thành viên.',
            );
          // LEFT/SUSPENDED may read their own history. Snapshot user fences rejoin/reassignment.
          scope = {
            providerId: member.providerId,
            memberId: selfMemberId,
            servingUserId: userId,
          };
        } else {
          const owner = await tx.providerMember.findFirst({
            where: {
              userId,
              role: 'OWNER',
              status: 'ACTIVE',
              provider: {
                userId,
                providerType: 'ORGANIZATION',
                user: { status: 'ACTIVE' },
              },
            },
            select: { providerId: true },
          });
          if (!owner)
            throw new ForbiddenException(
              'Chỉ owner đang hoạt động được xem tài chính tổ chức.',
            );
          if (
            filterMemberId &&
            !(await tx.providerMember.findFirst({
              where: { id: filterMemberId, providerId: owner.providerId },
              select: { id: true },
            }))
          )
            throw new NotFoundException(
              'Không tìm thấy thành viên trong tổ chức.',
            );
          scope = { providerId: owner.providerId, memberId: filterMemberId };
        }
        return {
          success: true,
          data: await report(tx, scope, range),
          meta: {
            providerId: scope.providerId,
            memberId: scope.memberId ?? null,
            from: range.from,
            to: range.to,
            toExclusive: true,
            timezone: 'Asia/Ho_Chi_Minh',
            currencyCode: 'VND',
            basis: 'COMPLETED_AT',
            asOf: new Date(),
            payrollIncluded: false,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 10000,
        maxWait: 2000,
      },
    );
  }
}
