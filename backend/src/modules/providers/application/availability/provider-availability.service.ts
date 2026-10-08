import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderLocationDto } from '../../dto/provider-location.dto';

@Injectable()
export class ProviderAvailabilityService {
  private readonly locationTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
  ) {
    this.locationTtlSeconds = this.config.get<number>(
      'cache.providerLocationTtlSeconds',
      120,
    );
  }

  async getStatus(userId: string) {
    const provider = await this.findProvider(userId);
    const session = await this.prisma.providerAvailabilitySession.findFirst({
      where: { providerId: provider.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, lastHeartbeatAt: true },
    });
    const online = session ? await this.locations.isOnline(provider.id) : false;
    return {
      success: true,
      data: {
        online,
        session: online ? session : null,
        heartbeatTtlSeconds: this.locationTtlSeconds,
      },
    };
  }

  async goOnline(
    userId: string,
    dto: ProviderLocationDto,
    request: RequestMetadata,
  ) {
    const provider = await this.findEligibleProvider(userId);
    await this.locations.upsert(provider.id, dto.latitude, dto.longitude);

    try {
      const session = await this.prisma.$transaction(async (transaction) => {
        await this.lockProvider(transaction, provider.id);
        const now = new Date();
        await transaction.providerAvailabilitySession.updateMany({
          where: { providerId: provider.id, endedAt: null },
          data: { endedAt: now, endReason: 'RECONNECTED' },
        });
        const created = await transaction.providerAvailabilitySession.create({
          data: { providerId: provider.id, lastHeartbeatAt: now },
          select: { id: true, startedAt: true, lastHeartbeatAt: true },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'PROVIDER_WENT_ONLINE',
            resourceType: 'ProviderAvailabilitySession',
            resourceId: created.id,
            result: 'SUCCESS',
          },
          request,
          transaction,
        );
        return created;
      });
      return {
        success: true,
        message: 'Đã bật trạng thái sẵn sàng nhận đơn.',
        data: {
          online: true,
          session,
          heartbeatTtlSeconds: this.locationTtlSeconds,
        },
      };
    } catch (error) {
      await this.locations.remove(provider.id).catch(() => undefined);
      throw error;
    }
  }

  async heartbeat(userId: string, dto: ProviderLocationDto) {
    const provider = await this.findEligibleProvider(userId);
    const activeSession =
      await this.prisma.providerAvailabilitySession.findFirst({
        where: { providerId: provider.id, endedAt: null },
        select: { id: true },
      });
    if (!activeSession) {
      throw new BadRequestException(
        'Nhà cung cấp chưa bật trạng thái online. Hãy bắt đầu phiên mới.',
      );
    }

    await this.locations.upsert(provider.id, dto.latitude, dto.longitude);
    const lastHeartbeatAt = new Date();
    await this.prisma.providerAvailabilitySession.update({
      where: { id: activeSession.id },
      data: { lastHeartbeatAt },
    });
    return {
      success: true,
      data: { online: true, lastHeartbeatAt },
    };
  }

  async goOffline(userId: string, request: RequestMetadata) {
    const provider = await this.findProvider(userId);
    await this.locations.remove(provider.id).catch(() => undefined);
    const endedAt = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.providerAvailabilitySession.findMany({
        where: { providerId: provider.id, endedAt: null },
        select: { id: true },
      });
      await transaction.providerAvailabilitySession.updateMany({
        where: { providerId: provider.id, endedAt: null },
        data: { endedAt, endReason: 'PROVIDER_OFFLINE' },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_WENT_OFFLINE',
          resourceType: 'ProviderProfile',
          resourceId: provider.id,
          result: 'SUCCESS',
          metadata: { closedSessionCount: sessions.length },
        },
        request,
        transaction,
      );
      return sessions.length;
    });
    return {
      success: true,
      message: 'Đã tắt trạng thái nhận đơn.',
      data: { online: false, closedSessionCount: result },
    };
  }

  private async findProvider(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        setupCompletedAt: true,
        serviceAreaLatitude: true,
        serviceAreaLongitude: true,
        serviceRadiusKm: true,
        _count: {
          select: {
            services: { where: { status: ProviderServiceStatus.ACTIVE } },
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
    }
    return provider;
  }

  private async findEligibleProvider(userId: string) {
    const provider = await this.findProvider(userId);
    if (provider.status === ProviderProfileStatus.SUSPENDED) {
      throw new ForbiddenException('Nhà cung cấp đang bị đình chỉ.');
    }
    if (
      provider.status !== ProviderProfileStatus.ACTIVE ||
      !provider.setupCompletedAt ||
      provider.serviceAreaLatitude === null ||
      provider.serviceAreaLongitude === null ||
      provider.serviceRadiusKm === null ||
      provider._count.services === 0
    ) {
      throw new BadRequestException(
        'Hãy hoàn tất khu vực, lịch làm việc và dịch vụ trước khi bật online.',
      );
    }
    return provider;
  }

  private async lockProvider(
    transaction: Prisma.TransactionClient,
    providerId: string,
  ): Promise<void> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id" = ${providerId} FOR UPDATE`,
    );
  }
}
