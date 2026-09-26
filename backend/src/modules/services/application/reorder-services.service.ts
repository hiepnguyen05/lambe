import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ReorderServicesDto } from '../dto/reorder-services.dto';
import { adminServiceSelect } from './service.select';
import { ServiceCacheService } from './service-cache.service';

@Injectable()
export class ReorderServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: ServiceCacheService,
  ) {}

  async execute(
    categoryId: string,
    dto: ReorderServicesDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Danh sách sắp xếp không được chứa dịch vụ trùng lặp.',
      );
    }

    const services = await this.prisma.$transaction(async (transaction) => {
      const category = await transaction.serviceCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
      }

      const existing = await transaction.service.findMany({
        where: { id: { in: ids }, categoryId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((service) => service.id));
      const missingIds = ids.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Không tìm thấy dịch vụ trong danh mục: ${missingIds.join(', ')}.`,
        );
      }

      for (const item of dto.items) {
        await transaction.service.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, updatedById: actorId },
        });
      }
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICES_REORDERED',
          resourceType: 'Service',
          result: 'SUCCESS',
          metadata: {
            categoryId,
            items: dto.items.map((item) => ({
              id: item.id,
              sortOrder: item.sortOrder,
            })),
          },
        },
        request,
        transaction,
      );
      return transaction.service.findMany({
        where: { id: { in: ids }, categoryId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: adminServiceSelect,
      });
    });

    await this.cache.invalidateActive();
    return {
      success: true,
      message: 'Sắp xếp dịch vụ thành công.',
      data: services,
    };
  }
}
