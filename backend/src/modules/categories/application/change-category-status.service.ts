import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateCategoryStatusDto } from '../dto/update-category-status.dto';
import { assertCategoryStatusTransition } from '../domain/category-status.policy';
import { adminCategorySelect } from './category.select';
import { CategoryCacheService } from './category-cache.service';

@Injectable()
export class ChangeCategoryStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: CategoryCacheService,
  ) {}

  async execute(
    id: string,
    dto: UpdateCategoryStatusDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const category = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.serviceCategory.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
      }

      assertCategoryStatusTransition(existing.status, dto.status);
      const updated = await transaction.serviceCategory.update({
        where: { id },
        data: { status: dto.status, updatedById: actorId },
        select: adminCategorySelect,
      });
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICE_CATEGORY_STATUS_CHANGED',
          resourceType: 'ServiceCategory',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { from: existing.status, to: dto.status },
        },
        request,
        transaction,
      );
      return updated;
    });

    await this.cache.invalidateActive();
    return {
      success: true,
      message: 'Cập nhật trạng thái danh mục thành công.',
      data: category,
    };
  }
}
