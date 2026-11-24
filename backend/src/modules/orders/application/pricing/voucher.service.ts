import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  VoucherIssuer,
  VoucherRedemptionStatus,
  VoucherStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { DEFAULT_COMMISSION_RATE_BPS } from '../order-eligibility.service';
import { calculateVoucherDiscount } from '../../domain/voucher.policy';
import type {
  CreateVoucherDto,
  VoucherListQueryDto,
} from '../../dto/voucher.dto';

type Database = Prisma.TransactionClient;
type PriceContext = {
  providerId: string;
  serviceId: string;
  servicePriceAmount: number;
  serviceFloorAmount: number;
  travelFeeAmount: number;
};

@Injectable()
export class VoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async price(
    customerId: string,
    code: string | undefined,
    context: PriceContext,
    tx: Database = this.prisma,
    reserve = false,
  ) {
    const subtotalAmount = context.servicePriceAmount + context.travelFeeAmount;
    const empty = {
      subtotalAmount,
      discountAmount: 0,
      totalAmount: subtotalAmount,
      voucherCode: null,
      voucherIssuer: null,
      platformFundedAmount: 0,
      providerFundedAmount: 0,
      commissionAmount: Math.ceil(
        (context.servicePriceAmount * DEFAULT_COMMISSION_RATE_BPS) / 10_000,
      ),
      voucherId: null,
    };
    if (!code) return empty;
    const normalized = code.trim().toUpperCase();
    const found = await tx.voucher.findUnique({ where: { code: normalized } });
    if (!found) throw new BadRequestException('Mã voucher không hợp lệ.');
    if (reserve) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "vouchers" WHERE "id" = ${found.id} FOR UPDATE`,
      );
    }
    const voucher = reserve
      ? await tx.voucher.findUniqueOrThrow({ where: { id: found.id } })
      : found;
    const now = new Date();
    if (
      voucher.status !== VoucherStatus.ACTIVE ||
      voucher.startsAt > now ||
      voucher.endsAt <= now
    )
      throw new ConflictException('Voucher chưa hiệu lực hoặc đã kết thúc.');
    if (
      (voucher.providerId && voucher.providerId !== context.providerId) ||
      (voucher.serviceId && voucher.serviceId !== context.serviceId)
    )
      throw new BadRequestException(
        'Voucher không áp dụng cho dịch vụ hoặc thợ này.',
      );
    if (context.servicePriceAmount < voucher.minOrderAmount)
      throw new BadRequestException(
        'Giá dịch vụ chưa đạt giá trị tối thiểu của voucher.',
      );
    const activeStatuses = [
      VoucherRedemptionStatus.RESERVED,
      VoucherRedemptionStatus.REDEEMED,
    ];
    const [uses, customerUses] = await Promise.all([
      tx.voucherRedemption.count({
        where: { voucherId: voucher.id, status: { in: activeStatuses } },
      }),
      tx.voucherRedemption.count({
        where: {
          voucherId: voucher.id,
          customerId,
          status: { in: activeStatuses },
        },
      }),
    ]);
    if (uses >= voucher.usageLimit || customerUses >= voucher.perCustomerLimit)
      throw new ConflictException('Voucher đã hết lượt sử dụng.');
    const discount = calculateVoucherDiscount(
      voucher,
      context.servicePriceAmount,
      context.serviceFloorAmount,
    );
    if (!discount.discountAmount)
      throw new BadRequestException(
        'Voucher không tạo được giảm giá cho dịch vụ này.',
      );
    return {
      subtotalAmount,
      discountAmount: discount.discountAmount,
      totalAmount: subtotalAmount - discount.discountAmount,
      voucherCode: voucher.code,
      voucherIssuer: voucher.issuer,
      platformFundedAmount: discount.platformFundedAmount,
      providerFundedAmount: discount.providerFundedAmount,
      commissionAmount: Math.ceil(
        (discount.commissionBaseAmount * DEFAULT_COMMISSION_RATE_BPS) / 10_000,
      ),
      voucherId: voucher.id,
    };
  }

  async create(
    issuer: VoucherIssuer,
    actorId: string,
    dto: CreateVoucherDto,
    request: RequestMetadata,
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt || endsAt <= new Date())
      throw new BadRequestException('Thời gian voucher không hợp lệ.');
    if (
      dto.discountType === 'PERCENTAGE' &&
      (dto.value > (issuer === VoucherIssuer.PROVIDER ? 30 : 100) ||
        !dto.maxDiscountAmount)
    )
      throw new BadRequestException(
        'Voucher phần trăm cần trần giảm giá và không vượt giới hạn.',
      );
    if (issuer === VoucherIssuer.PROVIDER && dto.providerId)
      throw new BadRequestException('Thợ không thể chọn chủ sở hữu voucher.');
    const provider =
      issuer === VoucherIssuer.PROVIDER
        ? await this.prisma.providerProfile.findFirst({
            where: { userId: actorId, status: 'ACTIVE' },
            select: { id: true },
          })
        : dto.providerId
          ? await this.prisma.providerProfile.findUnique({
              where: { id: dto.providerId },
              select: { id: true },
            })
          : null;
    if (
      (issuer === VoucherIssuer.PROVIDER && !provider) ||
      (dto.providerId && !provider)
    )
      throw new NotFoundException('Không tìm thấy thợ hợp lệ.');
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
        select: { id: true },
      });
      if (!service) throw new NotFoundException('Không tìm thấy dịch vụ.');
      if (issuer === VoucherIssuer.PROVIDER) {
        const offering = await this.prisma.providerService.findFirst({
          where: {
            providerId: provider!.id,
            serviceId: dto.serviceId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!offering)
          throw new BadRequestException('Thợ không cung cấp dịch vụ này.');
      }
    }
    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const created = await tx.voucher.create({
          data: {
            code: dto.code,
            issuer,
            providerId: provider?.id ?? null,
            serviceId: dto.serviceId ?? null,
            discountType: dto.discountType,
            value: dto.value,
            maxDiscountAmount: dto.maxDiscountAmount ?? null,
            minOrderAmount: dto.minOrderAmount ?? 0,
            startsAt,
            endsAt,
            usageLimit: dto.usageLimit,
            perCustomerLimit: dto.perCustomerLimit ?? 1,
          },
        });
        await this.audit.record(
          {
            ...(issuer === VoucherIssuer.PROVIDER
              ? { actorUserId: actorId }
              : { actorInternalAccountId: actorId }),
            action: 'VOUCHER_CREATED',
            resourceType: 'Voucher',
            resourceId: created.id,
            result: 'SUCCESS',
            metadata: { issuer, code: created.code },
          },
          request,
          tx,
        );
        return created;
      });
      return { success: true, data };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Mã voucher đã tồn tại.');
      throw error;
    }
  }

  async eligible(customerId: string, providerServiceId: string) {
    const offering = await this.prisma.providerService.findFirst({
      where: {
        id: providerServiceId,
        status: 'ACTIVE',
        provider: {
          status: 'ACTIVE',
          setupCompletedAt: { not: null },
          user: { status: 'ACTIVE' },
        },
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      select: {
        providerId: true,
        serviceId: true,
        priceAmount: true,
        service: { select: { minPriceAmount: true } },
      },
    });
    if (!offering)
      throw new NotFoundException(
        'Không tìm thấy dịch vụ đang hoạt động của thợ.',
      );
    const now = new Date();
    const candidates = await this.prisma.voucher.findMany({
      where: {
        status: VoucherStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
        OR: [{ providerId: null }, { providerId: offering.providerId }],
        AND: [{ OR: [{ serviceId: null }, { serviceId: offering.serviceId }] }],
        minOrderAmount: { lte: offering.priceAmount },
      },
      orderBy: { endsAt: 'asc' },
      take: 100,
    });
    if (!candidates.length) return { success: true, data: [] };
    const ids = candidates.map((item) => item.id);
    const active = {
      voucherId: { in: ids },
      status: {
        in: [
          VoucherRedemptionStatus.RESERVED,
          VoucherRedemptionStatus.REDEEMED,
        ],
      },
    };
    const [allCounts, customerCounts] = await Promise.all([
      this.prisma.voucherRedemption.groupBy({
        by: ['voucherId'],
        where: active,
        _count: { _all: true },
      }),
      this.prisma.voucherRedemption.groupBy({
        by: ['voucherId'],
        where: { ...active, customerId },
        _count: { _all: true },
      }),
    ]);
    const used = new Map(
      allCounts.map((item) => [item.voucherId, item._count._all]),
    );
    const usedByCustomer = new Map(
      customerCounts.map((item) => [item.voucherId, item._count._all]),
    );
    const data = [];
    for (const candidate of candidates) {
      const uses = used.get(candidate.id) ?? 0;
      const customerUses = usedByCustomer.get(candidate.id) ?? 0;
      if (
        uses >= candidate.usageLimit ||
        customerUses >= candidate.perCustomerLimit
      )
        continue;
      try {
        const discount = calculateVoucherDiscount(
          candidate,
          offering.priceAmount,
          offering.service.minPriceAmount,
        );
        if (discount.discountAmount)
          data.push({
            code: candidate.code,
            issuer: candidate.issuer,
            discountType: candidate.discountType,
            value: candidate.value,
            maxDiscountAmount: candidate.maxDiscountAmount,
            minOrderAmount: candidate.minOrderAmount,
            endsAt: candidate.endsAt,
            estimatedDiscountAmount: discount.discountAmount,
          });
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
      }
    }
    return { success: true, data };
  }

  async list(
    issuer: VoucherIssuer,
    actorId: string,
    query: VoucherListQueryDto,
  ) {
    const provider =
      issuer === VoucherIssuer.PROVIDER
        ? await this.prisma.providerProfile.findFirst({
            where: { userId: actorId },
            select: { id: true },
          })
        : null;
    if (issuer === VoucherIssuer.PROVIDER && !provider)
      throw new NotFoundException('Không tìm thấy hồ sơ thợ.');
    const activeAt = query.activeAt ? new Date(query.activeAt) : undefined;
    const where: Prisma.VoucherWhereInput = {
      issuer,
      providerId: issuer === VoucherIssuer.PROVIDER ? provider!.id : undefined,
      code: query.search
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
      status: query.status,
      startsAt: activeAt ? { lte: activeAt } : undefined,
      endsAt: activeAt ? { gt: activeAt } : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.voucher.count({ where }),
    ]);
    return {
      success: true,
      data,
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async disable(
    issuer: VoucherIssuer,
    actorId: string,
    id: string,
    request: RequestMetadata,
  ) {
    const provider =
      issuer === VoucherIssuer.PROVIDER
        ? await this.prisma.providerProfile.findFirst({
            where: { userId: actorId },
            select: { id: true },
          })
        : null;
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.voucher.updateMany({
        where: {
          id,
          ...(issuer === VoucherIssuer.PROVIDER
            ? { issuer, providerId: provider?.id ?? '' }
            : {}),
        },
        data: { status: VoucherStatus.INACTIVE },
      });
      if (!result.count) throw new NotFoundException('Không tìm thấy voucher.');
      await this.audit.record(
        {
          ...(issuer === VoucherIssuer.PROVIDER
            ? { actorUserId: actorId }
            : { actorInternalAccountId: actorId }),
          action: 'VOUCHER_DISABLED',
          resourceType: 'Voucher',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        tx,
      );
    });
    return { success: true, message: 'Đã ngừng voucher.' };
  }
}
