import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ReorderCategoriesDto } from '../dto/reorder-categories.dto';
import { adminCategorySelect } from './category.select';
import { CategoryCacheService } from './category-cache.service';

@Injectable()
export class ReorderCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: CategoryCacheService,
  ) {}

  async execute(
    dto: ReorderCategoriesDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Danh sách sắp xếp không được chứa danh mục trùng lặp.',
      );
    }

    const categories = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.serviceCategory.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((category) => category.id));
      const missingIds = ids.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Không tìm thấy danh mục: ${missingIds.join(', ')}.`,
        );
      }

      for (const item of dto.items) {
        await transaction.serviceCategory.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, updatedById: actorId },
        });
      }
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICE_CATEGORIES_REORDERED',
          resourceType: 'ServiceCategory',
          result: 'SUCCESS',
          metadata: {
            items: dto.items.map((item) => ({
              id: item.id,
              sortOrder: item.sortOrder,
            })),
          },
        },
        request,
        transaction,
      );
      return transaction.serviceCategory.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: adminCategorySelect,
      });
    });

    await this.cache.invalidateActive();
    return {
      success: true,
      message: 'Sắp xếp danh mục thành công.',
      data: categories,
    };
  }
}
