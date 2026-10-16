import {
  BadRequestException,
  ConflictException,
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
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderLocationDto } from '../../dto/provider-location.dto';
import { availableWalletBalance } from '../../domain/provider-receiving.policy';

const providerAvailabilitySelect = {
  id: true,
  status: true,
  setupCompletedAt: true,
  serviceAreaLatitude: true,
  serviceAreaLongitude: true,
  serviceRadiusKm: true,
  wallet: { select: { balanceAmount: true, heldAmount: true } },
  services: {
    where: {
      status: ProviderServiceStatus.ACTIVE,
      service: {
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
    },
    select: {
      priceAmount: true,
      service: { select: { minPriceAmount: true, maxPriceAmount: true } },
    },
  },
  _count: { select: { workingHours: true } },
} satisfies Prisma.ProviderProfileSelect;

type AvailabilityProvider = Prisma.ProviderProfileGetPayload<{
  select: typeof providerAvailabilitySelect;
}>;

interface AvailabilityBlocker {
  code: string;
  message: string;
  forbidden?: boolean;
}

@Injectable()
export class ProviderAvailabilityService {
  private readonly locationTtlSeconds: number;
  private readonly minimumReceivingBalance: number;

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
    this.minimumReceivingBalance = this.config.get<number>(
      'provider.minReceivingBalanceAmount',
      50_000,
    );
  }

  async getStatus(userId: string) {
    const provider = await this.findProvider(userId);
    const session = await this.prisma.providerAvailabilitySession.findFirst({
      where: { providerId: provider.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, lastHeartbeatAt: true },
    });
    const blocker = this.receivingBlocker(provider);
    const online =
      !blocker && session ? await this.locations.isOnline(provider.id) : false;
    return {
      success: true,
      data: {
        online,
        session: online ? session : null,
        heartbeatTtlSeconds: this.locationTtlSeconds,
        receivingEligibility: this.presentEligibility(provider, blocker),
      },
    };
  }

  async goOnline(
    userId: string,
    dto: ProviderLocationDto,
    request: RequestMetadata,
  ) {
    let providerId: string | undefined;
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        providerId = await this.lockProviderByUserId(transaction, userId);
        const provider = await this.findProvider(userId, transaction);
        const blocker = this.receivingBlocker(provider);
        const now = new Date();
        if (blocker) {
          await transaction.providerAvailabilitySession.updateMany({
            where: { providerId: provider.id, endedAt: null },
            data: { endedAt: now, endReason: blocker.code },
          });
          return { provider, blocker, session: null };
        }
        await transaction.providerAvailabilitySession.updateMany({
          where: { providerId: provider.id, endedAt: null },
          data: { endedAt: now, endReason: 'RECONNECTED' },
        });
        const created = await transaction.providerAvailabilitySession.create({
          data: { providerId: provider.id, lastHeartbeatAt: now },
          select: { id: true, startedAt: true, lastHeartbeatAt: true },
        });
        await this.locations.upsert(provider.id, dto.latitude, dto.longitude);
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
        return { provider, blocker: null, session: created };
      });
      if (result.blocker) {
        await this.locations.remove(result.provider.id).catch(() => undefined);
        throw this.blockerException(result.blocker, result.provider);
      }
      return {
        success: true,
        message: 'Đã bật trạng thái sẵn sàng nhận đơn.',
        data: {
          online: true,
          session: result.session,
          heartbeatTtlSeconds: this.locationTtlSeconds,
          receivingEligibility: this.presentEligibility(result.provider, null),
        },
      };
    } catch (error) {
      if (providerId) {
        await this.locations.remove(providerId).catch(() => undefined);
      }
      throw error;
    }
  }

  async heartbeat(userId: string, dto: ProviderLocationDto) {
    let providerId: string | undefined;
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        providerId = await this.lockProviderByUserId(transaction, userId);
        const provider = await this.findProvider(userId, transaction);
        const blocker = this.receivingBlocker(provider);
        if (blocker) {
          await transaction.providerAvailabilitySession.updateMany({
            where: { providerId: provider.id, endedAt: null },
            data: { endedAt: new Date(), endReason: blocker.code },
          });
          return { provider, blocker, lastHeartbeatAt: null };
        }
        const activeSession =
          await transaction.providerAvailabilitySession.findFirst({
            where: { providerId: provider.id, endedAt: null },
            select: { id: true },
          });
        if (!activeSession) {
          throw new BadRequestException(
            'Nhà cung cấp chưa bật trạng thái online. Hãy bắt đầu phiên mới.',
          );
        }

        const heartbeatAt = new Date();
        const updated =
          await transaction.providerAvailabilitySession.updateMany({
            where: { id: activeSession.id, endedAt: null },
            data: { lastHeartbeatAt: heartbeatAt },
          });
        if (updated.count !== 1) {
          throw new BadRequestException(
            'Phiên hoạt động đã kết thúc. Hãy bật lại trạng thái online.',
          );
        }
        await this.locations.upsert(provider.id, dto.latitude, dto.longitude);
        return { provider, blocker: null, lastHeartbeatAt: heartbeatAt };
      });
      if (result.blocker) {
        await this.locations.remove(result.provider.id).catch(() => undefined);
        throw this.blockerException(result.blocker, result.provider);
      }
      return {
        success: true,
        data: {
          online: true,
          lastHeartbeatAt: result.lastHeartbeatAt,
          receivingEligibility: this.presentEligibility(result.provider, null),
        },
      };
    } catch (error) {
      if (providerId) {
        await this.locations.remove(providerId).catch(() => undefined);
      }
      throw error;
    }
  }

  async goOffline(userId: string, request: RequestMetadata) {
    const endedAt = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const providerId = await this.lockProviderByUserId(transaction, userId);
      const provider = await this.findProvider(userId, transaction);
      const sessions = await transaction.providerAvailabilitySession.findMany({
        where: { providerId, endedAt: null },
        select: { id: true },
      });
      await transaction.providerAvailabilitySession.updateMany({
        where: { providerId, endedAt: null },
        data: { endedAt, endReason: 'PROVIDER_OFFLINE' },
      });
      await this.locations.remove(providerId);
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

  private async findProvider(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const provider = await client.providerProfile.findUnique({
      where: { userId },
      select: providerAvailabilitySelect,
    });
    if (!provider) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
    }
    return provider;
  }

  private receivingBlocker(
    provider: AvailabilityProvider,
  ): AvailabilityBlocker | null {
    if (provider.status === ProviderProfileStatus.SUSPENDED)
      return {
        code: 'PROVIDER_SUSPENDED',
        message: 'Nhà cung cấp đang bị đình chỉ.',
        forbidden: true,
      };
    if (
      provider.status !== ProviderProfileStatus.ACTIVE ||
      !provider.setupCompletedAt ||
      provider.serviceAreaLatitude === null ||
      provider.serviceAreaLongitude === null ||
      provider.serviceRadiusKm === null
    )
      return {
        code: 'PROVIDER_SETUP_INCOMPLETE',
        message:
          'Hãy hoàn tất khu vực, lịch làm việc và dịch vụ trước khi bật online.',
      };
    if (provider._count.workingHours === 0)
      return {
        code: 'PROVIDER_WORKING_HOURS_REQUIRED',
        message: 'Hãy cấu hình ít nhất một khung giờ làm việc.',
      };
    const eligibleServiceCount = provider.services.filter(
      (item) =>
        item.priceAmount >= item.service.minPriceAmount &&
        item.priceAmount <= item.service.maxPriceAmount,
    ).length;
    if (eligibleServiceCount === 0)
      return {
        code: 'PROVIDER_ACTIVE_SERVICE_REQUIRED',
        message: 'Không có dịch vụ đang hoạt động và đủ điều kiện nhận đơn.',
      };
    if (availableWalletBalance(provider.wallet) < this.minimumReceivingBalance)
      return {
        code: 'PROVIDER_WALLET_BALANCE_TOO_LOW',
        message: `Số dư khả dụng trong ví phải còn ít nhất ${this.minimumReceivingBalance.toLocaleString('vi-VN')}đ để nhận đơn.`,
      };
    return null;
  }

  private blockerException(
    blocker: AvailabilityBlocker,
    provider: AvailabilityProvider,
  ) {
    const response = {
      code: blocker.code,
      message: blocker.message,
      availableBalance: availableWalletBalance(provider.wallet),
      minimumBalance: this.minimumReceivingBalance,
    };
    return blocker.forbidden
      ? new ForbiddenException(response)
      : blocker.code === 'PROVIDER_WALLET_BALANCE_TOO_LOW'
        ? new ConflictException(response)
        : new BadRequestException(response);
  }

  private presentEligibility(
    provider: AvailabilityProvider,
    blocker: AvailabilityBlocker | null,
  ) {
    return {
      eligible: blocker === null,
      blockerCode: blocker?.code ?? null,
      availableBalance: availableWalletBalance(provider.wallet),
      minimumBalance: this.minimumReceivingBalance,
    };
  }

  private async lockProviderByUserId(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "userId" = ${userId} FOR UPDATE`,
    );
    if (!rows.length)
      throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
    return rows[0].id;
  }
}
