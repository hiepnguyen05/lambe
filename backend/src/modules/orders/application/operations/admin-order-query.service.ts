import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InternalRole, Prisma, ServiceOrderStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import type {
  AdminDashboardPeriod,
  AdminOrderQueryDto,
} from '../../dto/admin-order-query.dto';

const DAY_MS = 24 * 60 * 60_000;
const VN_OFFSET_MS = 7 * 60 * 60_000;

function vnLocal(date: Date): Date {
  return new Date(date.getTime() + VN_OFFSET_MS);
}

function startOfVnDay(date: Date): Date {
  const local = vnLocal(date);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      VN_OFFSET_MS,
  );
}

function growthPercentage(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function resolvePeriodBounds(period: AdminDashboardPeriod, now: Date) {
  const todayStart = startOfVnDay(now);
  if (period === 'today') {
    return {
      currentFrom: todayStart,
      prevFrom: new Date(todayStart.getTime() - DAY_MS),
      prevTo: new Date(now.getTime() - DAY_MS),
    };
  }
  if (period === 'month') {
    const local = vnLocal(now);
    const currentFrom = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - VN_OFFSET_MS,
    );
    const prevFrom = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) -
        VN_OFFSET_MS,
    );
    const prevTo = new Date(
      prevFrom.getTime() + (now.getTime() - currentFrom.getTime()),
    );
    return { currentFrom, prevFrom, prevTo };
  }
  const days = period === '30d' ? 30 : 7;
  const currentFrom = new Date(now.getTime() - days * DAY_MS);
  return {
    currentFrom,
    prevFrom: new Date(now.getTime() - days * 2 * DAY_MS),
    prevTo: currentFrom,
  };
}

const listSelect = {
  id: true,
  customerId: true,
  providerId: true,
  assignedMemberId: true,
  assignedMemberName: true,
  assignedMemberAvatarUrl: true,
  providerDisplayName: true,
  bookingType: true,
  scheduledAt: true,
  expectedStartAt: true,
  expectedEndAt: true,
  status: true,
  serviceName: true,
  totalAmount: true,
  currencyCode: true,
  createdAt: true,
  updatedAt: true,
  provider: { select: { displayName: true } },
} satisfies Prisma.ServiceOrderSelect;

const staffDetailSelect = {
  ...listSelect,
  providerServiceId: true,
  paymentMethod: true,
  servicePriceAmount: true,
  travelFeeAmount: true,
  durationMinutes: true,
  addressProvinceName: true,
  addressDistrictName: true,
  addressWardName: true,
  providerResponseDeadlineAt: true,
  acceptedAt: true,
  enRouteAt: true,
  arrivedAt: true,
  startedAt: true,
  completedAt: true,
  cashCollectedByUserId: true,
  cashCollectedAt: true,
  cashCollectedAmount: true,
  rejectedAt: true,
  rejectionReason: true,
  cancelledAt: true,
  paymentDisputeReason: true,
  paymentDisputeOpenedAt: true,
  paymentDisputeDecidedAt: true,
  paymentDisputeDecisionNote: true,
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      actorUserId: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  evidence: {
    select: { id: true, type: true, capturedAt: true },
    orderBy: { capturedAt: 'asc' as const },
  },
  cancellationRequest: {
    select: {
      id: true,
      reason: true,
      detail: true,
      status: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
    },
  },
  contactAttempts: {
    select: { attemptedAt: true },
    orderBy: { attemptedAt: 'asc' as const },
  },
  review: {
    select: { id: true, rating: true, comment: true, createdAt: true },
  },
} satisfies Prisma.ServiceOrderSelect;

const adminDetailSelect = {
  ...staffDetailSelect,
  commissionAmount: true,
  commissionRateBps: true,
  addressLabel: true,
  addressLine: true,
  addressStreetLine: true,
  addressLatitude: true,
  addressLongitude: true,
  addressNote: true,
  contactName: true,
  contactPhone: true,
  customerNote: true,
  customer: { select: { fullName: true, phone: true } },
} satisfies Prisma.ServiceOrderSelect;

@Injectable()
export class AdminOrderQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async analytics(
    period: AdminDashboardPeriod,
    actor: AuthenticatedInternalAccount,
  ) {
    const now = new Date();
    const { currentFrom, prevFrom, prevTo } = resolvePeriodBounds(period, now);
    const canReadAlerts = actor.roles.some(
      (role) => role === InternalRole.ADMIN || role === InternalRole.SUPPORT,
    );
    const growthStart = new Date(now.getTime() - 28 * DAY_MS);

    const [
      curGroups,
      prevGroups,
      topServices,
      completedServiceGmv,
      activeProviders,
      newProvidersInPeriod,
      urgentAlertsCount,
      recentAlerts,
      trendRows,
      growthRows,
    ] = await Promise.all([
      this.prisma.serviceOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: currentFrom, lte: now } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: prevFrom, lt: prevTo } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['serviceName'],
        where: { createdAt: { gte: currentFrom, lte: now } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.serviceOrder.groupBy({
        by: ['serviceName'],
        where: {
          createdAt: { gte: currentFrom, lte: now },
          status: ServiceOrderStatus.COMPLETED,
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.providerProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.providerProfile.count({
        where: {
          status: 'ACTIVE',
          createdAt: { gte: currentFrom, lte: now },
        },
      }),
      canReadAlerts
        ? this.prisma.orderOperationalAlert.count({ where: { status: 'OPEN' } })
        : Promise.resolve(0),
      canReadAlerts
        ? this.prisma.orderOperationalAlert.findMany({
            where: { status: { not: 'RESOLVED' } },
            orderBy: { detectedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              type: true,
              status: true,
              detectedAt: true,
              order: {
                select: {
                  id: true,
                  serviceName: true,
                  providerDisplayName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      period === 'today'
        ? this.prisma.$queryRaw<
            Array<{
              bucket: string;
              orders: bigint | number;
              revenue: bigint | number;
            }>
          >(Prisma.sql`
            SELECT lpad((floor(extract(hour from ("createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')) / 2) * 2)::int::text, 2, '0') || ':00' AS bucket,
                   COUNT(*)::bigint AS orders,
                   COALESCE(SUM(CASE WHEN "status" = 'COMPLETED' THEN "totalAmount" ELSE 0 END), 0)::bigint AS revenue
            FROM "service_orders"
            WHERE "createdAt" >= ${currentFrom} AND "createdAt" <= ${now}
            GROUP BY 1
          `)
        : this.prisma.$queryRaw<
            Array<{
              bucket: string;
              orders: bigint | number;
              revenue: bigint | number;
            }>
          >(Prisma.sql`
            SELECT extract(day from ("createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int::text || '/' || extract(month from ("createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int::text AS bucket,
                   COUNT(*)::bigint AS orders,
                   COALESCE(SUM(CASE WHEN "status" = 'COMPLETED' THEN "totalAmount" ELSE 0 END), 0)::bigint AS revenue
            FROM "service_orders"
            WHERE "createdAt" >= ${currentFrom} AND "createdAt" <= ${now}
            GROUP BY 1
          `),
      this.prisma.$queryRaw<
        Array<{
          week_index: number;
          customers: bigint | number;
          providers: bigint | number;
        }>
      >(Prisma.sql`
        WITH bounds AS (
          SELECT week_index,
                 ${growthStart} + (week_index - 1) * INTERVAL '7 days' AS start_at,
                 CASE WHEN week_index = 4 THEN ${new Date(now.getTime() + 1)} ELSE ${growthStart} + week_index * INTERVAL '7 days' END AS end_at
          FROM generate_series(1, 4) AS week_index
        )
        SELECT b.week_index,
               COALESCE((SELECT COUNT(*) FROM "users" u JOIN "user_role_assignments" r ON r."userId" = u."id" AND r."role" = 'CUSTOMER' WHERE u."createdAt" >= b.start_at AND u."createdAt" < b.end_at), 0)::bigint AS customers,
               COALESCE((SELECT COUNT(*) FROM "provider_profiles" p WHERE p."createdAt" >= b.start_at AND p."createdAt" < b.end_at), 0)::bigint AS providers
        FROM bounds b
        ORDER BY b.week_index ASC
      `),
    ]);

    const summarizeOrders = (groups: typeof curGroups) => {
      let total = 0;
      let completed = 0;
      let gmv = 0;
      let active = 0;
      let pending = 0;
      let cancelled = 0;
      let disputed = 0;
      for (const row of groups) {
        const count = row._count.id;
        const amount = Number(row._sum.totalAmount ?? 0);
        total += count;
        if (row.status === ServiceOrderStatus.COMPLETED) {
          completed += count;
          gmv += amount;
        } else if (
          row.status === ServiceOrderStatus.EN_ROUTE ||
          row.status === ServiceOrderStatus.ARRIVED ||
          row.status === ServiceOrderStatus.IN_PROGRESS
        ) {
          active += count;
        } else if (
          row.status === ServiceOrderStatus.PENDING_PROVIDER ||
          row.status === ServiceOrderStatus.ACCEPTED
        ) {
          pending += count;
        } else if (
          row.status === ServiceOrderStatus.CANCELLED ||
          row.status === ServiceOrderStatus.REJECTED ||
          row.status === ServiceOrderStatus.EXPIRED
        ) {
          cancelled += count;
        } else {
          disputed += count;
        }
      }
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        total,
        completed,
        gmv,
        completionRate,
        counts: { completed, active, pending, cancelled, disputed },
      };
    };

    const currentSummary = summarizeOrders(curGroups);
    const prevSummary = summarizeOrders(prevGroups);

    const trendLookup = new Map(
      trendRows.map((row) => [
        row.bucket,
        { orders: Number(row.orders), revenue: Number(row.revenue) },
      ]),
    );
    const revenueTrend: Array<{
      date: string;
      rawDate: string;
      revenue: number;
      orders: number;
    }> = [];
    if (period === 'today') {
      for (let h = 0; h <= 22; h += 2) {
        const label = `${String(h).padStart(2, '0')}:00`;
        const hit = trendLookup.get(label);
        revenueTrend.push({
          date: label,
          rawDate: label,
          revenue: hit?.revenue ?? 0,
          orders: hit?.orders ?? 0,
        });
      }
    } else {
      const startDay = startOfVnDay(currentFrom);
      const endDay = startOfVnDay(now);
      for (let ts = startDay.getTime(); ts <= endDay.getTime(); ts += DAY_MS) {
        const local = vnLocal(new Date(ts));
        const key = `${local.getUTCDate()}/${local.getUTCMonth() + 1}`;
        const hit = trendLookup.get(key);
        revenueTrend.push({
          date: key,
          rawDate: key,
          revenue: hit?.revenue ?? 0,
          orders: hit?.orders ?? 0,
        });
      }
    }

    const totalStatus = currentSummary.total || 1;
    const statusDistribution = [
      {
        status: 'COMPLETED',
        label: 'Hoàn tất',
        count: currentSummary.counts.completed,
        percentage: Math.round(
          (currentSummary.counts.completed / totalStatus) * 100,
        ),
        color: '#10b981',
      },
      {
        status: 'ACTIVE',
        label: 'Đang thực hiện',
        count: currentSummary.counts.active,
        percentage: Math.round(
          (currentSummary.counts.active / totalStatus) * 100,
        ),
        color: '#06b6d4',
      },
      {
        status: 'PENDING',
        label: 'Chờ tiếp nhận',
        count: currentSummary.counts.pending,
        percentage: Math.round(
          (currentSummary.counts.pending / totalStatus) * 100,
        ),
        color: '#f59e0b',
      },
      {
        status: 'CANCELLED',
        label: 'Đã hủy',
        count: currentSummary.counts.cancelled,
        percentage: Math.round(
          (currentSummary.counts.cancelled / totalStatus) * 100,
        ),
        color: '#94a3b8',
      },
      {
        status: 'DISPUTED',
        label: 'Tranh chấp',
        count: currentSummary.counts.disputed,
        percentage: Math.round(
          (currentSummary.counts.disputed / totalStatus) * 100,
        ),
        color: '#f43f5e',
      },
    ];

    const serviceRevenueMap = new Map(
      completedServiceGmv.map((row) => [
        row.serviceName,
        Number(row._sum.totalAmount ?? 0),
      ]),
    );
    const categoryBreakdown = topServices.map((row) => ({
      name: row.serviceName || 'Dịch vụ khác',
      orders: row._count.id,
      revenue: serviceRevenueMap.get(row.serviceName) ?? 0,
      percentage:
        currentSummary.total > 0
          ? Math.round((row._count.id / currentSummary.total) * 100)
          : 0,
    }));

    const growthMap = new Map(
      growthRows.map((row) => [Number(row.week_index), row]),
    );
    const growthTrend = [1, 2, 3, 4].map((index) => {
      const row = growthMap.get(index);
      return {
        period: `Tuần ${index}`,
        newCustomers: canReadAlerts ? Number(row?.customers ?? 0) : 0,
        newProviders: Number(row?.providers ?? 0),
      };
    });

    return {
      success: true,
      data: {
        period,
        kpis: {
          gmv: currentSummary.gmv,
          gmvGrowth: growthPercentage(currentSummary.gmv, prevSummary.gmv),
          totalBookings: currentSummary.total,
          bookingGrowth: growthPercentage(
            currentSummary.total,
            prevSummary.total,
          ),
          completionRate: currentSummary.completionRate,
          completionRateDelta:
            currentSummary.completionRate - prevSummary.completionRate,
          activeProviders,
          activeProvidersDelta: newProvidersInPeriod,
          urgentAlertsCount,
        },
        revenueTrend,
        statusDistribution,
        categoryBreakdown,
        growthTrend,
        recentAlerts: recentAlerts.map((alert) => ({
          id: alert.id,
          type: alert.type,
          status: alert.status,
          orderId: alert.order?.id,
          serviceName: alert.order?.serviceName,
          providerDisplayName: alert.order?.providerDisplayName ?? undefined,
          detectedAt: alert.detectedAt.toISOString(),
        })),
      },
    };
  }

  async list(query: AdminOrderQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to)
      throw new BadRequestException('Khoang thoi gian khong hop le.');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ServiceOrderWhereInput = {
      status: query.status,
      bookingType: query.bookingType,
      customerId: query.customerId,
      providerId: query.providerId,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);
    return {
      success: true,
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(
    id: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    const admin = actor.roles.includes(InternalRole.ADMIN);
    const order = admin
      ? await this.prisma.serviceOrder.findUnique({
          where: { id },
          select: adminDetailSelect,
        })
      : await this.prisma.serviceOrder.findUnique({
          where: { id },
          select: staffDetailSelect,
        });
    if (!order) throw new NotFoundException('Khong tim thay don hang.');
    if (admin) {
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: 'ORDER_CONTACT_VIEWED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
      );
    }
    return {
      success: true,
      data: { ...order, timeline: this.timeline(order) },
    };
  }

  async evidenceUrl(
    orderId: string,
    evidenceId: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    const evidence = await this.prisma.orderEvidence.findFirst({
      where: { id: evidenceId, orderId },
      select: {
        id: true,
        type: true,
        capturedAt: true,
        publicId: true,
        fileFormat: true,
      },
    });
    if (!evidence) throw new NotFoundException('Khong tim thay bang chung.');
    const url = this.storage.createPrivateDownloadUrl(
      evidence.publicId,
      evidence.fileFormat,
    );
    await this.audit.record(
      {
        actorInternalAccountId: actor.accountId,
        action: 'ORDER_EVIDENCE_VIEWED',
        resourceType: 'OrderEvidence',
        resourceId: evidenceId,
        result: 'SUCCESS',
        metadata: { orderId },
      },
      request,
    );
    return {
      success: true,
      data: {
        id: evidence.id,
        type: evidence.type,
        capturedAt: evidence.capturedAt,
        url,
      },
    };
  }

  private timeline(
    order: Prisma.ServiceOrderGetPayload<{ select: typeof staffDetailSelect }>,
  ) {
    const events = [
      ...order.statusHistory.map((item) => ({
        kind: 'STATUS',
        at: item.createdAt,
        id: item.id,
        value: item.toStatus,
        reason: item.reason,
      })),
      ...order.evidence.map((item) => ({
        kind: 'EVIDENCE',
        at: item.capturedAt,
        id: item.id,
        value: item.type,
        reason: null,
      })),
      ...(order.cancellationRequest
        ? [
            {
              kind: 'CANCELLATION_REQUEST',
              at: order.cancellationRequest.requestedAt,
              id: order.cancellationRequest.id,
              value: order.cancellationRequest.status,
              reason: order.cancellationRequest.reason,
            },
          ]
        : []),
    ];
    return events.sort(
      (a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id),
    );
  }
}
