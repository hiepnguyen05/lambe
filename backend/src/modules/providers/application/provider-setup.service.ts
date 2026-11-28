import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceOrderStatus,
  ServiceStatus,
  ServiceCategoryStatus,
} from '@prisma/client';
import { discoveryProviderSummaryCacheKey } from '../../../common/cache/discovery-cache.keys';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import type {
  ProviderSetupDto,
  ProviderServiceAreaDto,
  ProviderWorkingHourDto,
} from '../dto/provider-setup.dto';
import { assertWorkingHoursValid } from '../domain/provider-setup.policy';

const providerSetupSelect = {
  id: true,
  providerType: true,
  acceptingMemberOrders: true,
  displayName: true,
  avatarUrl: true,
  biography: true,
  status: true,
  serviceAreaName: true,
  serviceAreaLatitude: true,
  serviceAreaLongitude: true,
  serviceRadiusKm: true,
  setupCompletedAt: true,
  workingHours: {
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    select: { dayOfWeek: true, startMinute: true, endMinute: true },
  },
  services: {
    select: {
      id: true,
      serviceId: true,
      priceAmount: true,
      status: true,
      service: {
        select: {
          name: true,
          targetAudience: true,
          status: true,
          category: { select: { status: true } },
        },
      },
    },
  },
} satisfies Prisma.ProviderProfileSelect;

@Injectable()
export class ProviderSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() @Inject(CACHE_STORE) private readonly cache?: CacheStore,
  ) {}

  async findMine(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: providerSetupSelect,
    });
    if (!provider)
      throw new NotFoundException(
        'Chỉ nhà cung cấp đã được duyệt mới có thể thiết lập.',
      );

    const reviewAgg = this.prisma.orderReview?.aggregate;
    const orderCount = this.prisma.serviceOrder?.count;
    if (typeof reviewAgg !== 'function' || typeof orderCount !== 'function') {
      return { success: true, data: provider };
    }

    const [reviewSummary, completedOrdersCount] = await Promise.all([
      this.prisma.orderReview.aggregate({
        where: { providerId: provider.id },
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.serviceOrder.count({
        where: {
          providerId: provider.id,
          status: ServiceOrderStatus.COMPLETED,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        ...provider,
        stats: {
          rating: reviewSummary._avg.rating,
          reviewCount: reviewSummary._count.id,
          completedOrdersCount,
        },
      },
    };
  }

  async updateRadius(
    userId: string,
    serviceRadiusKm: number,
    request: RequestMetadata,
  ) {
    const providerId = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockEditableProvider(tx, userId);
      const id = provider.id;
      await tx.providerProfile.update({
        where: { id },
        data: { serviceRadiusKm },
      });
      if (provider.status === ProviderProfileStatus.SETUP_REQUIRED)
        await this.completeInitialSetupIfReady(tx, id);
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_RADIUS_UPDATED',
          resourceType: 'ProviderProfile',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { serviceRadiusKm },
        },
        request,
        tx,
      );
      return id;
    });
    await this.cache
      ?.delete(discoveryProviderSummaryCacheKey(providerId))
      .catch(() => undefined);
    return { success: true, data: { serviceRadiusKm } };
  }

  async updateWorkingHours(
    userId: string,
    workingHours: ProviderWorkingHourDto[],
    request: RequestMetadata,
  ) {
    assertWorkingHoursValid(workingHours);
    const providerId = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockEditableProvider(tx, userId);
      const id = provider.id;
      await tx.providerWorkingHour.deleteMany({ where: { providerId: id } });
      await tx.providerWorkingHour.createMany({
        data: workingHours.map((slot) => ({
          providerId: id,
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        })),
      });
      if (provider.status === ProviderProfileStatus.SETUP_REQUIRED)
        await this.completeInitialSetupIfReady(tx, id);
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_WORKING_HOURS_UPDATED',
          resourceType: 'ProviderProfile',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { workingHoursCount: workingHours.length },
        },
        request,
        tx,
      );
      return id;
    });
    await this.cache
      ?.delete(discoveryProviderSummaryCacheKey(providerId))
      .catch(() => undefined);
    return { success: true, data: { workingHours } };
  }

  async updateServiceArea(
    userId: string,
    dto: ProviderServiceAreaDto,
    request: RequestMetadata,
  ) {
    const area = {
      serviceAreaName: dto.serviceAreaName,
      serviceAreaLatitude: dto.serviceAreaLatitude,
      serviceAreaLongitude: dto.serviceAreaLongitude,
      serviceRadiusKm: dto.serviceRadiusKm,
    };
    const providerId = await this.prisma.$transaction(async (tx) => {
      const provider = await this.lockEditableProvider(tx, userId);
      await tx.providerProfile.update({
        where: { id: provider.id },
        data: area,
      });
      if (provider.status === ProviderProfileStatus.SETUP_REQUIRED)
        await this.completeInitialSetupIfReady(tx, provider.id);
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_SERVICE_AREA_UPDATED',
          resourceType: 'ProviderProfile',
          resourceId: provider.id,
          result: 'SUCCESS',
          metadata: { serviceRadiusKm: dto.serviceRadiusKm },
        },
        request,
        tx,
      );
      return provider.id;
    });
    await this.cache
      ?.delete(discoveryProviderSummaryCacheKey(providerId))
      .catch(() => undefined);
    return { success: true, data: area };
  }

  private async lockEditableProvider(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const rows = await tx.$queryRaw<
      { id: string; status: ProviderProfileStatus }[]
    >(
      Prisma.sql`SELECT "id", "status" FROM "provider_profiles" WHERE "userId" = ${userId} FOR UPDATE`,
    );
    const provider = rows[0];
    if (!provider)
      throw new NotFoundException(
        'Chỉ nhà cung cấp đã được duyệt mới có thể thiết lập.',
      );
    if (provider.status === ProviderProfileStatus.SUSPENDED)
      throw new ForbiddenException('Nhà cung cấp đang bị đình chỉ.');
    return provider;
  }

  private async completeInitialSetupIfReady(
    tx: Prisma.TransactionClient,
    providerId: string,
  ) {
    const setup = await tx.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      select: {
        serviceAreaName: true,
        serviceAreaLatitude: true,
        serviceAreaLongitude: true,
        serviceRadiusKm: true,
        workingHours: { select: { id: true }, take: 1 },
        services: {
          where: {
            status: {
              in: [
                ProviderServiceStatus.ACTIVE,
                ProviderServiceStatus.INACTIVE,
              ],
            },
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
          select: {
            id: true,
            status: true,
            priceAmount: true,
            service: { select: { minPriceAmount: true, maxPriceAmount: true } },
          },
        },
      },
    });
    const eligible = setup.services.filter(
      (item) =>
        item.priceAmount >= item.service.minPriceAmount &&
        item.priceAmount <= item.service.maxPriceAmount,
    );
    if (
      !setup.serviceAreaName?.trim() ||
      setup.serviceAreaLatitude === null ||
      setup.serviceAreaLongitude === null ||
      setup.serviceRadiusKm === null ||
      setup.workingHours.length === 0 ||
      eligible.length === 0
    )
      return;
    const inactiveIds = eligible
      .filter((item) => item.status === ProviderServiceStatus.INACTIVE)
      .map((item) => item.id);
    if (inactiveIds.length)
      await tx.providerService.updateMany({
        where: {
          providerId,
          id: { in: inactiveIds },
          status: ProviderServiceStatus.INACTIVE,
        },
        data: { status: ProviderServiceStatus.ACTIVE },
      });
    await tx.providerProfile.update({
      where: { id: providerId },
      data: {
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: new Date(),
      },
    });
  }

  async configure(
    userId: string,
    dto: ProviderSetupDto,
    request: RequestMetadata,
  ) {
    assertWorkingHoursValid(dto.workingHours);
    const provider = await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "userId" = ${userId} FOR UPDATE`,
      );
      if (!rows.length)
        throw new NotFoundException(
          'Chỉ nhà cung cấp đã được duyệt mới có thể thiết lập.',
        );
      const current = await transaction.providerProfile.findUnique({
        where: { userId },
        include: { services: true },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
      if (current.status === ProviderProfileStatus.SUSPENDED)
        throw new ForbiddenException('Nhà cung cấp đang bị đình chỉ.');
      await transaction.$queryRaw(Prisma.sql`
        SELECT service."id" FROM "services" service
        JOIN "service_categories" category ON category."id" = service."categoryId"
        JOIN "provider_services" offering ON offering."serviceId" = service."id"
        WHERE offering."providerId" = ${current.id}
          AND offering."id" IN (${Prisma.join(dto.enabledServiceIds)})
        ORDER BY service."id" FOR SHARE OF service, category
      `);
      const services = await transaction.providerService.findMany({
        where: { providerId: current.id, id: { in: dto.enabledServiceIds } },
        include: { service: { include: { category: true } } },
      });
      if (services.length !== dto.enabledServiceIds.length)
        throw new BadRequestException(
          'Dịch vụ chưa được duyệt hoặc không thuộc nhà cung cấp.',
        );
      for (const item of services) {
        if (
          item.status === ProviderServiceStatus.SUSPENDED ||
          item.service.status !== ServiceStatus.ACTIVE ||
          item.service.category.status !== ServiceCategoryStatus.ACTIVE ||
          item.priceAmount < item.service.minPriceAmount ||
          item.priceAmount > item.service.maxPriceAmount
        )
          throw new BadRequestException(
            'Dịch vụ không đủ điều kiện hoạt động; vui lòng liên hệ hỗ trợ.',
          );
      }
      await transaction.providerWorkingHour.deleteMany({
        where: { providerId: current.id },
      });
      await transaction.providerWorkingHour.createMany({
        data: dto.workingHours.map((slot) => ({
          providerId: current.id,
          ...slot,
        })),
      });
      await transaction.providerService.updateMany({
        where: {
          providerId: current.id,
          status: { not: ProviderServiceStatus.SUSPENDED },
        },
        data: { status: ProviderServiceStatus.INACTIVE },
      });
      await transaction.providerService.updateMany({
        where: {
          providerId: current.id,
          id: { in: dto.enabledServiceIds },
          status: { not: ProviderServiceStatus.SUSPENDED },
        },
        data: { status: ProviderServiceStatus.ACTIVE },
      });
      const updated = await transaction.providerProfile.update({
        where: { id: current.id },
        data: {
          serviceAreaName: dto.serviceAreaName,
          serviceAreaLatitude: dto.serviceAreaLatitude,
          serviceAreaLongitude: dto.serviceAreaLongitude,
          serviceRadiusKm: dto.serviceRadiusKm,
          setupCompletedAt: current.setupCompletedAt ?? new Date(),
          status: ProviderProfileStatus.ACTIVE,
        },
        select: providerSetupSelect,
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'PROVIDER_SETUP_UPDATED',
          resourceType: 'ProviderProfile',
          resourceId: current.id,
          result: 'SUCCESS',
          metadata: {
            enabledServiceCount: services.length,
            serviceRadiusKm: dto.serviceRadiusKm,
          },
        },
        request,
        transaction,
      );
      return updated;
    });
    await this.cache
      ?.delete(discoveryProviderSummaryCacheKey(provider.id))
      .catch(() => undefined);
    return {
      success: true,
      message: 'Đã thiết lập hồ sơ nhà cung cấp. Chưa bật trạng thái nhận đơn.',
      data: provider,
    };
  }
}
