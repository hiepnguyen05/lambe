import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProviderDocumentType } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import {
  assertChangeEditable,
  lockProviderForServiceChange,
} from './provider-service-changes.service';

@Injectable()
export class ProviderServiceChangeDocumentsService {
  private readonly logger = new Logger(
    ProviderServiceChangeDocumentsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStorage,
  ) {}

  async upload(
    userId: string,
    id: string,
    type: ProviderDocumentType,
    buffer: Buffer,
  ) {
    this.assertType(type);
    const existing = await this.prisma.providerServiceChangeRequest.findFirst({
      where: { id, provider: { userId } },
      select: { status: true },
    });
    if (!existing)
      throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
    assertChangeEditable(existing.status);
    const uploaded = await this.media.uploadPrivateImage(
      buffer,
      `lambe/provider-service-changes/${id}`,
    );
    try {
      if (uploaded.deliveryType !== 'authenticated' || !uploaded.format)
        throw new ConflictException('Tài liệu phải được lưu riêng tư.');
      const document = await this.prisma.$transaction(async (tx) => {
        const provider = await lockProviderForServiceChange(tx, userId);
        const current = await tx.providerServiceChangeRequest.findFirst({
          where: { id, providerId: provider.id },
          select: { status: true },
        });
        if (!current)
          throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
        assertChangeEditable(current.status);
        if (
          (await tx.providerServiceChangeDocument.count({
            where: { requestId: id },
          })) >= 10
        )
          throw new BadRequestException(
            'Mỗi yêu cầu chỉ được tải tối đa 10 tài liệu.',
          );
        return tx.providerServiceChangeDocument.create({
          data: {
            requestId: id,
            type,
            publicId: uploaded.publicId,
            fileFormat: uploaded.format,
            deliveryType: uploaded.deliveryType,
          },
          select: { id: true, type: true, status: true, createdAt: true },
        });
      });
      return { success: true, data: document };
    } catch (error) {
      await this.deleteImage(uploaded.publicId);
      throw error;
    }
  }

  async remove(userId: string, id: string, documentId: string) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const provider = await lockProviderForServiceChange(tx, userId);
      const current = await tx.providerServiceChangeRequest.findFirst({
        where: { id, providerId: provider.id },
        select: { status: true },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy yêu cầu thay đổi.');
      assertChangeEditable(current.status);
      const document = await tx.providerServiceChangeDocument.findFirst({
        where: { id: documentId, requestId: id },
      });
      if (!document) throw new NotFoundException('Không tìm thấy tài liệu.');
      await tx.providerServiceChangeDocument.delete({
        where: { id: documentId },
      });
      return document;
    });
    await this.deleteImage(removed.publicId);
    return { success: true, message: 'Đã xóa tài liệu.' };
  }

  async access(
    id: string,
    documentId: string,
    request: RequestMetadata,
    userId?: string,
    actorId?: string,
  ) {
    const document = await this.prisma.providerServiceChangeDocument.findFirst({
      where: {
        id: documentId,
        requestId: id,
        ...(userId ? { request: { provider: { userId } } } : {}),
      },
      select: {
        id: true,
        publicId: true,
        fileFormat: true,
        deliveryType: true,
      },
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu.');
    if (document.deliveryType !== 'authenticated' || !document.fileFormat)
      throw new ConflictException('Tài liệu chưa được lưu riêng tư.');
    await this.audit.record(
      {
        actorUserId: userId,
        actorInternalAccountId: actorId,
        action: 'PROVIDER_SERVICE_CHANGE_DOCUMENT_ACCESSED',
        resourceType: 'ProviderServiceChangeDocument',
        resourceId: documentId,
        result: 'SUCCESS',
        metadata: { requestId: id },
      },
      request,
    );
    return {
      success: true,
      data: {
        url: this.media.createPrivateDownloadUrl(
          document.publicId,
          document.fileFormat,
        ),
        fileFormat: document.fileFormat,
      },
    };
  }

  private assertType(type: ProviderDocumentType) {
    if (
      type !== ProviderDocumentType.PROFESSIONAL_CERTIFICATE &&
      type !== ProviderDocumentType.PORTFOLIO
    )
      throw new BadRequestException(
        'Chỉ chấp nhận chứng chỉ nghề hoặc ảnh portfolio.',
      );
  }

  private async deleteImage(publicId: string) {
    try {
      await this.media.deleteImage(publicId, 'authenticated');
    } catch (error) {
      this.logger.warn(`Không thể dọn ảnh ${publicId}: ${String(error)}`);
    }
  }
}
