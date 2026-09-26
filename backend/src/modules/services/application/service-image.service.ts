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
import { adminServiceSelect, toServiceAuditSnapshot } from './service.select';
import { ServiceCacheService } from './service-cache.service';

@Injectable()
export class ServiceImageService {
  private readonly logger = new Logger(ServiceImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: ServiceCacheService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
  ) {}

  async uploadCover(
    id: string,
    buffer: Buffer,
    actorId: string,
    request: RequestMetadata = {},
  ) {
    const existing = await this.findService(id);
    const uploaded = await this.mediaStorage.uploadImage(
      buffer,
      `lambe/services/${id}`,
    );

    try {
      const service = await this.prisma.$transaction(async (transaction) => {
        const write = await transaction.service.updateMany({
          where: { id, updatedAt: existing.updatedAt },
          data: {
            coverImageUrl: uploaded.secureUrl,
            coverImagePublicId: uploaded.publicId,
            updatedById: actorId,
          },
        });
        if (write.count !== 1) {
          throw new ConflictException(
            'Dịch vụ vừa được cập nhật. Vui lòng tải lại và thử lại.',
          );
        }

        const updated = await transaction.service.findUniqueOrThrow({
          where: { id },
          select: adminServiceSelect,
        });
        await this.auditService.record(
          {
            actorInternalAccountId: actorId,
            action: 'SERVICE_COVER_UPDATED',
            resourceType: 'Service',
            resourceId: id,
            result: 'SUCCESS',
            metadata: {
              before: toServiceAuditSnapshot(existing),
              after: toServiceAuditSnapshot(updated),
              imagePublicId: uploaded.publicId,
            },
          },
          request,
          transaction,
        );
        return updated;
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
        message: 'Cập nhật ảnh dịch vụ thành công.',
        data: service,
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
    const existing = await this.findService(id);
    if (!existing.coverImageUrl) {
      throw new BadRequestException('Dịch vụ chưa có ảnh bìa.');
    }

    const service = await this.prisma.$transaction(async (transaction) => {
      const write = await transaction.service.updateMany({
        where: { id, updatedAt: existing.updatedAt },
        data: {
          coverImageUrl: null,
          coverImagePublicId: null,
          updatedById: actorId,
        },
      });
      if (write.count !== 1) {
        throw new ConflictException(
          'Dịch vụ vừa được cập nhật. Vui lòng tải lại và thử lại.',
        );
      }
      const updated = await transaction.service.findUniqueOrThrow({
        where: { id },
        select: adminServiceSelect,
      });
      await this.auditService.record(
        {
          actorInternalAccountId: actorId,
          action: 'SERVICE_COVER_REMOVED',
          resourceType: 'Service',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { before: toServiceAuditSnapshot(existing) },
        },
        request,
        transaction,
      );
      return updated;
    });

    await this.cache.invalidateActive();
    if (existing.coverImagePublicId) {
      await this.deleteManagedImage(existing.coverImagePublicId);
    }
    return {
      success: true,
      message: 'Xóa ảnh dịch vụ thành công.',
      data: service,
    };
  }

  private async findService(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ.');
    return service;
  }

  private async deleteManagedImage(publicId: string): Promise<void> {
    try {
      const deleted = await this.mediaStorage.deleteImage(publicId);
      if (!deleted)
        this.logger.warn(`Cloud image was not deleted: ${publicId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Cloud image cleanup failed for ${publicId}: ${message}`,
      );
    }
  }
}
