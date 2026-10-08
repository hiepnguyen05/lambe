import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ProviderType,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  AdminProviderStatusAction,
  type AdminProviderQueryDto,
  type UpdateAdminProviderStatusDto,
} from '../../dto/admin-provider-management.dto';

const providerListSelect = {
  id: true,
  providerType: true,
  displayName: true,
  avatarUrl: true,
  experienceYears: true,
  status: true,
  serviceAreaName: true,
  serviceRadiusKm: true,
  setupCompletedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      status: true,
    },
  },
  services: { select: { status: true } },
  availabilitySessions: {
    where: { endedAt: null },
    orderBy: { lastHeartbeatAt: 'desc' },
    take: 1,
    select: { lastHeartbeatAt: true },
  },
} satisfies Prisma.ProviderProfileSelect;

const providerDetailSelect = {
  ...providerListSelect,
  biography: true,
  serviceAreaLatitude: true,
  serviceAreaLongitude: true,
  sourceApplicationId: true,
  wallet: {
    select: {
      balanceAmount: true,
      heldAmount: true,
      currencyCode: true,
      updatedAt: true,
    },
  },
  workingHours: {
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    select: { dayOfWeek: true, startMinute: true, endMinute: true },
  },
  services: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      priceAmount: true,
      durationMinutes: true,
      description: true,
      status: true,
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ProviderProfileSelect;

@Injectable()
export class AdminProviderManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
  ) {}

  async findAll(query: AdminProviderQueryDto) {
    const where = this.buildWhere(query);
    const summaryWhere = this.buildWhere({
      search: query.search,
    });
    const [
      providers,
      total,
      setupRequired,
      active,
      suspended,
      individuals,
      organizations,
    ] = await this.prisma.$transaction([
      this.prisma.providerProfile.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: providerListSelect,
      }),
      this.prisma.providerProfile.count({ where }),
      this.prisma.providerProfile.count({
        where: {
          ...summaryWhere,
          status: ProviderProfileStatus.SETUP_REQUIRED,
        },
      }),
      this.prisma.providerProfile.count({
        where: { ...summaryWhere, status: ProviderProfileStatus.ACTIVE },
      }),
      this.prisma.providerProfile.count({
        where: { ...summaryWhere, status: ProviderProfileStatus.SUSPENDED },
      }),
      this.prisma.providerProfile.count({
        where: { ...summaryWhere, providerType: ProviderType.INDIVIDUAL },
      }),
      this.prisma.providerProfile.count({
        where: { ...summaryWhere, providerType: ProviderType.ORGANIZATION },
      }),
    ]);

    return {
      success: true,
      data: providers.map((provider) => this.mapListItem(provider)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        summary: {
          total: setupRequired + active + suspended,
          setupRequired,
          active,
          suspended,
          individuals,
          organizations,
        },
      },
    };
  }

  async findOne(providerId: string, actorId: string, request: RequestMetadata) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: providerDetailSelect,
    });
    if (!provider)
      throw new NotFoundException('Không tìm thấy chuyên viên hoặc đối tác.');

    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: 'PROVIDER_PROFILE_ACCESSED',
        resourceType: 'ProviderProfile',
        resourceId: providerId,
        result: 'SUCCESS',
      },
      request,
    );

    return { success: true, data: this.mapDetail(provider) };
  }

  async updateStatus(
    providerId: string,
    dto: UpdateAdminProviderStatusDto,
    actorId: string,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE`,
      );
      const current = await transaction.providerProfile.findUnique({
        where: { id: providerId },
        select: { status: true, setupCompletedAt: true },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy chuyên viên hoặc đối tác.');

      const nextStatus =
        dto.status === AdminProviderStatusAction.SUSPENDED
          ? ProviderProfileStatus.SUSPENDED
          : current.setupCompletedAt
            ? ProviderProfileStatus.ACTIVE
            : ProviderProfileStatus.SETUP_REQUIRED;

      if (current.status === nextStatus) {
        throw new BadRequestException('Hồ sơ đã ở trạng thái được yêu cầu.');
      }
      if (
        dto.status === AdminProviderStatusAction.ACTIVE &&
        current.status !== ProviderProfileStatus.SUSPENDED
      ) {
        throw new BadRequestException(
          'Chỉ có thể khôi phục hồ sơ đang bị đình chỉ.',
        );
      }

      let closedSessionCount = 0;
      if (nextStatus === ProviderProfileStatus.SUSPENDED) {
        const sessions =
          await transaction.providerAvailabilitySession.updateMany({
            where: { providerId, endedAt: null },
            data: { endedAt: new Date(), endReason: 'PROVIDER_SUSPENDED' },
          });
        closedSessionCount = sessions.count;
      }

      const updated = await transaction.providerProfile.update({
        where: { id: providerId },
        data: { status: nextStatus },
        select: providerDetailSelect,
      });

      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'PROVIDER_STATUS_CHANGED',
          resourceType: 'ProviderProfile',
          resourceId: providerId,
          result: 'SUCCESS',
          metadata: {
            from: current.status,
            to: nextStatus,
            reason: dto.reason.trim(),
            closedSessionCount,
          },
        },
        request,
        transaction,
      );

      return { provider: this.mapDetail(updated), nextStatus };
    });

    if (result.nextStatus === ProviderProfileStatus.SUSPENDED) {
      await this.locations.remove(providerId).catch(() => undefined);
    }

    return {
      success: true,
      message:
        result.nextStatus === ProviderProfileStatus.SUSPENDED
          ? 'Đã đình chỉ hoạt động của nhà cung cấp.'
          : 'Đã khôi phục hoạt động của nhà cung cấp.',
      data: result.provider,
    };
  }

  private buildWhere(
    query: Pick<AdminProviderQueryDto, 'search' | 'providerType' | 'status'>,
  ) {
    const where: Prisma.ProviderProfileWhereInput = {};
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { serviceAreaName: { contains: search, mode: 'insensitive' } },
        {
          user: { is: { fullName: { contains: search, mode: 'insensitive' } } },
        },
        { user: { is: { phone: { contains: search } } } },
      ];
    }
    if (query.providerType) where.providerType = query.providerType;
    if (query.status) where.status = query.status;
    return where;
  }

  private mapListItem(
    provider: Prisma.ProviderProfileGetPayload<{
      select: typeof providerListSelect;
    }>,
  ) {
    const { services, availabilitySessions, ...profile } = provider;
    return {
      ...profile,
      serviceCounts: {
        total: services.length,
        active: services.filter(
          (item) => item.status === ProviderServiceStatus.ACTIVE,
        ).length,
        suspended: services.filter(
          (item) => item.status === ProviderServiceStatus.SUSPENDED,
        ).length,
      },
      isOnline: availabilitySessions.length > 0,
      lastHeartbeatAt: availabilitySessions[0]?.lastHeartbeatAt ?? null,
    };
  }

  private mapDetail(
    provider: Prisma.ProviderProfileGetPayload<{
      select: typeof providerDetailSelect;
    }>,
  ) {
    const { availabilitySessions, ...profile } = provider;
    return {
      ...profile,
      isOnline: availabilitySessions.length > 0,
      lastHeartbeatAt: availabilitySessions[0]?.lastHeartbeatAt ?? null,
    };
  }
}
