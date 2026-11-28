import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderDocumentType,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ProviderType,
  ReviewStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
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
      avatarUrl: true,
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
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
  ) {}

  async findAll(query: AdminProviderQueryDto) {
    const where = this.buildWhere(query);
    const summaryWhere = this.buildWhere({
      search: query.search,
    });
    const groupedCounts = this.prisma.providerProfile.groupBy({
      by: ['status', 'providerType'],
      where: summaryWhere,
      _count: { _all: true },
    });
    const [providers, groups] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: providerListSelect,
      }),
      groupedCounts,
    ]);

    const summary = {
      total: 0,
      setupRequired: 0,
      active: 0,
      suspended: 0,
      individuals: 0,
      organizations: 0,
    };
    let total = 0;
    for (const group of groups) {
      const count = group._count._all;
      summary.total += count;
      if (group.status === ProviderProfileStatus.SETUP_REQUIRED)
        summary.setupRequired += count;
      if (group.status === ProviderProfileStatus.ACTIVE)
        summary.active += count;
      if (group.status === ProviderProfileStatus.SUSPENDED)
        summary.suspended += count;
      if (group.providerType === ProviderType.INDIVIDUAL)
        summary.individuals += count;
      if (group.providerType === ProviderType.ORGANIZATION)
        summary.organizations += count;
      if (
        (!query.status || group.status === query.status) &&
        (!query.providerType || group.providerType === query.providerType)
      )
        total += count;
    }

    return {
      success: true,
      data: providers.map((provider) => this.mapListItem(provider)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        summary,
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

  async syncAvatar(
    providerId: string,
    actorId: string | undefined,
    request: RequestMetadata,
    onlyIfMissing = false,
  ) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        userId: true,
        sourceApplicationId: true,
        user: { select: { avatarPublicId: true } },
        sourceApplication: {
          select: {
            documents: {
              where: {
                type: ProviderDocumentType.PORTRAIT,
                status: ReviewStatus.VERIFIED,
                isPublicCandidate: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                publicId: true,
                fileFormat: true,
                deliveryType: true,
              },
            },
          },
        },
      },
    });
    if (!provider)
      throw new NotFoundException('Không tìm thấy chuyên viên hoặc đối tác.');
    const portrait = provider.sourceApplication.documents[0];
    if (
      !portrait?.publicId ||
      !portrait.fileFormat ||
      portrait.deliveryType !== 'authenticated'
    ) {
      throw new BadRequestException(
        'Hồ sơ không có ảnh chân dung đã xác minh để đồng bộ.',
      );
    }

    const avatar = await this.mediaStorage.publishPrivateImage(
      portrait.publicId,
      portrait.fileFormat,
      `lambe/users/${provider.userId}/avatar`,
    );

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE`,
        );
        if (onlyIfMissing) {
          const current = await transaction.providerProfile.findUnique({
            where: { id: providerId },
            select: { avatarUrl: true, user: { select: { avatarUrl: true } } },
          });
          if (current?.avatarUrl && current.user.avatarUrl) {
            throw new BadRequestException('Avatar already synchronized.');
          }
        }
        const currentPortrait =
          await transaction.providerApplicationDocument.findFirst({
            where: {
              id: portrait.id,
              applicationId: provider.sourceApplicationId,
              publicId: portrait.publicId,
              type: ProviderDocumentType.PORTRAIT,
              status: ReviewStatus.VERIFIED,
            },
            select: { id: true },
          });
        if (!currentPortrait) {
          throw new BadRequestException(
            'Ảnh chân dung đã thay đổi và không thể đồng bộ.',
          );
        }

        await transaction.user.update({
          where: { id: provider.userId },
          data: {
            avatarUrl: avatar.secureUrl,
            avatarPublicId: avatar.publicId,
          },
        });
        const profile = await transaction.providerProfile.update({
          where: { id: providerId },
          data: { avatarUrl: avatar.secureUrl },
          select: providerDetailSelect,
        });
        await this.audit.record(
          {
            actorInternalAccountId: actorId,
            action: 'PROVIDER_PORTRAIT_PUBLISHED',
            resourceType: 'ProviderProfile',
            resourceId: providerId,
            result: 'SUCCESS',
            metadata: {
              sourceDocumentId: portrait.id,
              avatarPublicId: avatar.publicId,
            },
          },
          request,
          transaction,
        );
        return this.mapDetail(profile);
      });

      if (
        provider.user.avatarPublicId &&
        provider.user.avatarPublicId !== avatar.publicId
      ) {
        await this.mediaStorage
          .deleteImage(provider.user.avatarPublicId)
          .catch(() => undefined);
      }
      return {
        success: true,
        message: 'Đã đồng bộ ảnh chân dung thành ảnh đại diện.',
        data: updated,
      };
    } catch (error: unknown) {
      await this.mediaStorage
        .deleteImage(avatar.publicId)
        .catch(() => undefined);
      throw error;
    }
  }

  async backfillMissingAvatars(
    options: { cursor?: string; limit?: number } = {},
  ) {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new BadRequestException(
        'Backfill limit must be between 1 and 500.',
      );
    }
    const missingAvatar: Prisma.ProviderProfileWhereInput = {
      OR: [{ avatarUrl: null }, { user: { is: { avatarUrl: null } } }],
    };
    let cursor = options.cursor;
    let cursorCreatedAt: Date | undefined;
    if (cursor) {
      const existing = await this.prisma.providerProfile.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (!existing)
        throw new BadRequestException('Backfill cursor not found.');
      cursorCreatedAt = existing.createdAt;
    }
    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    while (scanned < limit) {
      const providers = await this.prisma.providerProfile.findMany({
        where: cursorCreatedAt
          ? {
              AND: [
                missingAvatar,
                {
                  OR: [
                    { createdAt: { gt: cursorCreatedAt } },
                    { createdAt: cursorCreatedAt, id: { gt: cursor } },
                  ],
                },
              ],
            }
          : missingAvatar,
        select: { id: true, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: Math.min(25, limit - scanned),
      });
      if (!providers.length) break;
      for (const provider of providers) {
        cursor = provider.id;
        cursorCreatedAt = provider.createdAt;
        scanned += 1;
        try {
          await this.syncAvatar(
            provider.id,
            undefined,
            { requestId: 'provider-avatar-backfill' },
            true,
          );
          updated += 1;
        } catch (error: unknown) {
          if (error instanceof BadRequestException) skipped += 1;
          else failed += 1;
        }
      }
    }
    return { scanned, updated, skipped, failed, nextCursor: cursor ?? null };
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
      avatarUrl: profile.avatarUrl ?? profile.user.avatarUrl,
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
      avatarUrl: profile.avatarUrl ?? profile.user.avatarUrl,
      isOnline: availabilitySessions.length > 0,
      lastHeartbeatAt: availabilitySessions[0]?.lastHeartbeatAt ?? null,
    };
  }
}
