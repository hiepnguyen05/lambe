import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../upload/application/media-storage.port';
import {
  adminCategorySelect,
  toCategoryAuditSnapshot,
} from './category.select';
import { CategoryCacheService } from './category-cache.service';

@Injectable()
export class CategoryImageService {
  private readonly logger = new Logger(CategoryImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: CategoryCacheService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
  ) {}

  async uploadCover(
    id: string,
    buffer: Buffer,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const existing = await this.findCategory(id);
    const uploaded = await this.mediaStorage.uploadImage(
      buffer,
      `lambe/categories/${id}`,
    );

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const write = await transaction.serviceCategory.updateMany({
          where: { id, updatedAt: existing.updatedAt },
          data: {
            coverImageUrl: uploaded.secureUrl,
            coverImagePublicId: uploaded.publicId,
            updatedById: actorId,
          },
        });
        if (write.count !== 1) {
          throw new ConflictException(
            'Danh mục vừa được cập nhật. Vui lòng tải lại và thử lại.',
          );
        }

        const category = await transaction.serviceCategory.findUniqueOrThrow({
          where: { id },
          select: adminCategorySelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_CATEGORY_COVER_UPDATED',
            resourceType: 'ServiceCategory',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              before: toCategoryAuditSnapshot(existing),
              after: toCategoryAuditSnapshot(category),
              imagePublicId: uploaded.publicId,
            },
          },
          request,
          transaction,
        );
        return category;
      });

      await this.cache.invalidateActive();
      if (
        existing.coverImagePublicId &&
        existing.coverImagePublicId !== uploaded.publicId
      ) {
        await this.deleteManagedImage(existing.coverImagePublicId);
      }

      return {
        success: true,
        message: 'Cập nhật ảnh danh mục thành công.',
        data: updated,
      };
    } catch (error: unknown) {
      await this.deleteManagedImage(uploaded.publicId);
      throw error;
    }
  }

  async removeCover(
    id: string,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const existing = await this.findCategory(id);
    if (!existing.coverImageUrl) {
      throw new BadRequestException('Danh mục chưa có ảnh bìa.');
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.serviceCategory.updateMany({
        where: { id, updatedAt: existing.updatedAt },
        data: {
          coverImageUrl: null,
          coverImagePublicId: null,
          updatedById: actorId,
        },
      });
      if (write.count !== 1) {
        throw new ConflictException(
          'Danh mục vừa được cập nhật. Vui lòng tải lại và thử lại.',
        );
      }

      const category = await transaction.serviceCategory.findUniqueOrThrow({
        where: { id },
        select: adminCategorySelect,
      });
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICE_CATEGORY_COVER_REMOVED',
          resourceType: 'ServiceCategory',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { before: toCategoryAuditSnapshot(existing) },
        },
        request,
        transaction,
      );
      return category;
    });

    await this.cache.invalidateActive();
    if (existing.coverImagePublicId) {
      await this.deleteManagedImage(existing.coverImagePublicId);
    }

    return {
      success: true,
      message: 'Xóa ảnh danh mục thành công.',
      data: updated,
    };
  }

  private async findCategory(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
    }
    return category;
  }

  private async deleteManagedImage(publicId: string): Promise<void> {
    try {
      const deleted = await this.mediaStorage.deleteImage(publicId);
      if (!deleted) {
        this.logger.warn(`Cloud image was not deleted: ${publicId}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Cloud image cleanup failed for ${publicId}: ${message}`,
      );
    }
  }
}
