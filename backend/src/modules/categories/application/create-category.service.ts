import { Injectable } from '@nestjs/common';
import { ServiceCategoryStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CreateCategoryDto } from '../dto/create-category.dto';
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
export class CreateCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly uniqueness: CategoryUniquenessService,
    private readonly cache: CategoryCacheService,
  ) {}

  async execute(
    dto: CreateCategoryDto,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const normalizedName = normalizeCategoryName(name);
    const slug = dto.slug.trim().toLowerCase();

    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        await this.uniqueness.assertAvailable(transaction, {
          code,
          normalizedName,
          slug,
        });
        const created = await transaction.serviceCategory.create({
          data: {
            code,
            name,
            normalizedName,
            slug,
            description: trimOptionalCategoryField(dto.description),
            iconUrl: trimOptionalCategoryField(dto.iconUrl),
            coverImageUrl: trimOptionalCategoryField(dto.coverImageUrl),
            sortOrder: dto.sortOrder ?? 0,
            status: ServiceCategoryStatus.INACTIVE,
            createdById: actorId,
            updatedById: actorId,
          },
          select: adminCategorySelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_CATEGORY_CREATED',
            resourceType: 'ServiceCategory',
            resourceId: created.id,
            result: 'SUCCESS',
            metadata: { after: toCategoryAuditSnapshot(created) },
          },
          request,
          transaction,
        );
        return created;
      });

      await this.cache.invalidateActive();
      return {
        success: true,
        message: 'Tạo danh mục dịch vụ thành công.',
        data: category,
      };
    } catch (error: unknown) {
      rethrowCategoryWriteError(error);
    }
  }
}
