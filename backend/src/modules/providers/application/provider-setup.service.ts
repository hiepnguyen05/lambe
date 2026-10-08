import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceStatus,
  ServiceCategoryStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import type { ProviderSetupDto } from '../dto/provider-setup.dto';
import { assertWorkingHoursValid } from '../domain/provider-setup.policy';
import { lockProviderCatalog } from '../../provider-applications/application/persistence/provider-application-lock';

const providerSetupSelect = {
  id: true,
  providerType: true,
  displayName: true,
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
    return { success: true, data: provider };
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
      await lockProviderCatalog(transaction, current.sourceApplicationId);
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
    return {
      success: true,
      message: 'Đã thiết lập hồ sơ nhà cung cấp. Chưa bật trạng thái nhận đơn.',
      data: provider,
    };
  }
}
