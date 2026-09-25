import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UpdateCategoryDto } from '../dto/update-category.dto';
import {
  normalizeCategoryName,
  trimOptionalCategoryField,
} from '../domain/category-normalizer';
import {
  adminCategorySelect,
  toCategoryAuditSnapshot,
} from './category.select';
import { CategoryCacheService } from './category-cache.service';
import {
  CategoryUniquenessService,
  rethrowCategoryWriteError,
} from './category-uniqueness.service';

@Injectable()
export class UpdateCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly uniqueness: CategoryUniquenessService,
    private readonly cache: CategoryCacheService,
  ) {}

  async execute(
    id: string,
    dto: UpdateCategoryDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('Cần cung cấp ít nhất một trường để sửa.');
    }

    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.serviceCategory.findUnique({
          where: { id },
        });
        if (!existing) {
          throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
        }

        const updates: Prisma.ServiceCategoryUncheckedUpdateInput = {
          updatedById: actorId,
        };
        const uniqueInput: { normalizedName?: string; slug?: string } = {};

        if (dto.name !== undefined) {
          const name = dto.name.trim();
          updates.name = name;
          updates.normalizedName = normalizeCategoryName(name);
          uniqueInput.normalizedName = updates.normalizedName;
        }
        if (dto.slug !== undefined) {
          updates.slug = dto.slug.trim().toLowerCase();
          uniqueInput.slug = updates.slug;
        }
        if (dto.description !== undefined) {
          updates.description = trimOptionalCategoryField(dto.description);
        }
        if (dto.iconUrl !== undefined) {
          updates.iconUrl = trimOptionalCategoryField(dto.iconUrl);
        }
        if (dto.coverImageUrl !== undefined) {
          updates.coverImageUrl = trimOptionalCategoryField(dto.coverImageUrl);
        }
        if (dto.sortOrder !== undefined) updates.sortOrder = dto.sortOrder;

        await this.uniqueness.assertAvailable(transaction, uniqueInput, id);
        const updated = await transaction.serviceCategory.update({
          where: { id },
          data: updates,
          select: adminCategorySelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_CATEGORY_UPDATED',
            resourceType: 'ServiceCategory',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              before: toCategoryAuditSnapshot(existing),
              after: toCategoryAuditSnapshot(updated),
            },
          },
          request,
          transaction,
        );
        return updated;
      });

      await this.cache.invalidateActive();
      return {
        success: true,
        message: 'Cập nhật danh mục dịch vụ thành công.',
        data: category,
      };
    } catch (error: unknown) {
      rethrowCategoryWriteError(error);
    }
  }
}
