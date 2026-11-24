import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  BookingType,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceOrderStatus,
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
import { ProviderServiceChangeNotificationService } from './provider-service-change-notification.service';

const offeringInclude = {
  service: {
    select: {
      id: true,
      name: true,
      status: true,
      iconUrl: true,
      minPriceAmount: true,
      maxPriceAmount: true,
      defaultDurationMinutes: true,
      category: { select: { id: true, name: true, status: true } },
    },
  },
} satisfies Prisma.ProviderServiceInclude;

@Injectable()
export class ProviderServicesService {
  private readonly logger = new Logger(ProviderServicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: ProviderServiceChangeNotificationService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
  ) {}

  async listMine(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy hồ sơ đối tác.');
    const offerings = await this.prisma.providerService.findMany({
      where: { providerId: provider.id },
      include: offeringInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { success: true, data: offerings.map((item) => this.present(item)) };
  }

  async findMine(userId: string, id: string) {
    const item = await this.prisma.providerService.findFirst({
      where: { id, provider: { userId } },
      include: offeringInclude,
    });
    if (!item)
      throw new NotFoundException('Không tìm thấy dịch vụ của đối tác.');
    return { success: true, data: this.present(item) };
  }

  async setAvailability(
    userId: string,
    id: string,
    active: boolean,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockProvider(tx, { userId });
      if (provider.status === ProviderProfileStatus.SUSPENDED)
        throw new ForbiddenException('Đối tác đang bị đình chỉ.');
      const item = await tx.providerService.findFirst({
        where: { id, providerId: provider.id },
        include: offeringInclude,
      });
      if (!item)
        throw new NotFoundException('Không tìm thấy dịch vụ của đối tác.');
      if (item.status === ProviderServiceStatus.SUSPENDED)
        throw new ForbiddenException('Dịch vụ đã bị đình chỉ.');
      if (!active && item.status === ProviderServiceStatus.ACTIVE) {
        const pendingAsap = await tx.serviceOrder.count({
          where: {
            providerServiceId: id,
            status: ServiceOrderStatus.PENDING_PROVIDER,
            bookingType: BookingType.ASAP,
            providerResponseDeadlineAt: { gt: new Date() },
          },
        });
        if (pendingAsap)
          throw new BadRequestException(
            'Hãy phản hồi đơn đặt ngay đang chờ trước khi tạm ngừng dịch vụ.',
          );
      }
      if (active) {
        if (
          provider.status !== ProviderProfileStatus.ACTIVE ||
          !provider.setupCompletedAt
        )
          throw new BadRequestException(
            'Hãy hoàn tất thiết lập đối tác trước.',
          );
        this.assertCatalogActive(item);
      }
      const status = active
        ? ProviderServiceStatus.ACTIVE
        : ProviderServiceStatus.INACTIVE;
      const updated =
        item.status === status
          ? item
          : await tx.providerService.update({
              where: { id },
              data: { status },
              include: offeringInclude,
            });
      const offline =
        !active && (await this.closeIfNoActiveService(tx, provider.id));
      if (item.status !== status) {
        await this.audit.record(
          {
            actorUserId: userId,
            action: active
              ? 'PROVIDER_SERVICE_ACTIVATED'
              : 'PROVIDER_SERVICE_PAUSED',
            resourceType: 'ProviderService',
            resourceId: id,
            result: 'SUCCESS',
          },
          request,
          tx,
        );
      }
      return { item: updated, providerId: provider.id, offline };
    });
    if (result.offline) await this.removeLocation(result.providerId);
    return {
      success: true,
      message: active ? 'Đã bật dịch vụ.' : 'Đã tạm ngừng dịch vụ.',
      data: this.present(result.item),
    };
  }

  async suspend(
    providerId: string,
    id: string,
    reason: string,
    actorId: string,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockProvider(tx, { id: providerId });
      const item = await tx.providerService.findFirst({
        where: { id, providerId },
        include: offeringInclude,
      });
      if (!item) throw new NotFoundException('Không tìm thấy dịch vụ đối tác.');
      if (item.status === ProviderServiceStatus.SUSPENDED)
        throw new BadRequestException('Dịch vụ đã bị đình chỉ.');
      const updated = await tx.providerService.update({
        where: { id },
        data: {
          status: ProviderServiceStatus.SUSPENDED,
          suspensionReason: reason.trim(),
          suspendedAt: new Date(),
        },
        include: offeringInclude,
      });
      const offline = await this.closeIfNoActiveService(tx, provider.id);
      const source = await tx.providerApplication.findUnique({
        where: { id: provider.sourceApplicationId },
        select: { email: true },
      });
      await this.notifications.enqueueSuspension(
        source?.email ?? null,
        false,
        tx,
      );
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'PROVIDER_SERVICE_SUSPENDED',
          resourceType: 'ProviderService',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { providerId, reason: reason.trim() },
        },
        request,
        tx,
      );
      return { item: updated, offline };
    });
    if (result.offline) await this.removeLocation(providerId);
    return { success: true, data: this.present(result.item) };
  }

  async restore(
    providerId: string,
    id: string,
    actorId: string,
    request: RequestMetadata,
  ) {
    const item = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockProvider(tx, { id: providerId });
      const current = await tx.providerService.findFirst({
        where: { id, providerId },
        include: offeringInclude,
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy dịch vụ đối tác.');
      if (current.status !== ProviderServiceStatus.SUSPENDED)
        throw new BadRequestException('Dịch vụ không ở trạng thái đình chỉ.');
      const updated = await tx.providerService.update({
        where: { id },
        data: {
          status: ProviderServiceStatus.INACTIVE,
          suspensionReason: null,
          suspendedAt: null,
        },
        include: offeringInclude,
      });
      const source = await tx.providerApplication.findUnique({
        where: { id: provider.sourceApplicationId },
        select: { email: true },
      });
      await this.notifications.enqueueSuspension(
        source?.email ?? null,
        true,
        tx,
      );
      await this.audit.record(
        {
          actorInternalAccountId: actorId,
          action: 'PROVIDER_SERVICE_RESTORED',
          resourceType: 'ProviderService',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { providerId },
        },
        request,
        tx,
      );
      return updated;
    });
    return { success: true, data: this.present(item) };
  }

  private async lockProvider(
    tx: Prisma.TransactionClient,
    where: { userId?: string; id?: string },
  ) {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "provider_profiles"
      WHERE (${where.userId ?? null}::text IS NULL OR "userId" = ${where.userId ?? null})
        AND (${where.id ?? null}::text IS NULL OR "id" = ${where.id ?? null})
      FOR UPDATE
    `);
    if (!rows.length)
      throw new NotFoundException('Không tìm thấy hồ sơ đối tác.');
    return tx.providerProfile.findUniqueOrThrow({
      where: { id: rows[0].id },
      select: {
        id: true,
        status: true,
        setupCompletedAt: true,
        sourceApplicationId: true,
      },
    });
  }

  private assertCatalogActive(
    item: Prisma.ProviderServiceGetPayload<{ include: typeof offeringInclude }>,
  ) {
    if (
      item.service.status !== ServiceStatus.ACTIVE ||
      item.service.category.status !== ServiceCategoryStatus.ACTIVE ||
      item.priceAmount < item.service.minPriceAmount ||
      item.priceAmount > item.service.maxPriceAmount
    )
      throw new BadRequestException('Dịch vụ không đủ điều kiện hoạt động.');
  }

  private async closeIfNoActiveService(
    tx: Prisma.TransactionClient,
    providerId: string,
  ) {
    const valid = await tx.providerService.findMany({
      where: {
        providerId,
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
    });
    if (
      valid.some(
        (item) =>
          item.priceAmount >= item.service.minPriceAmount &&
          item.priceAmount <= item.service.maxPriceAmount,
      )
    )
      return false;
    await tx.providerAvailabilitySession.updateMany({
      where: { providerId, endedAt: null },
      data: { endedAt: new Date(), endReason: 'NO_ACTIVE_SERVICE' },
    });
    return true;
  }

  private async removeLocation(providerId: string) {
    try {
      await this.locations.remove(providerId);
    } catch (error) {
      this.logger.warn(
        `Unable to remove provider ${providerId} from location cache: ${String(error)}`,
      );
    }
  }

  private present(
    item: Prisma.ProviderServiceGetPayload<{ include: typeof offeringInclude }>,
  ) {
    const reason =
      item.status === ProviderServiceStatus.SUSPENDED
        ? 'SUSPENDED'
        : item.service.status !== ServiceStatus.ACTIVE
          ? 'SERVICE_INACTIVE'
          : item.service.category.status !== ServiceCategoryStatus.ACTIVE
            ? 'CATEGORY_INACTIVE'
            : item.priceAmount < item.service.minPriceAmount ||
                item.priceAmount > item.service.maxPriceAmount
              ? 'PRICE_OUT_OF_RANGE'
              : null;
    return { ...item, blockerCode: reason };
  }
}
