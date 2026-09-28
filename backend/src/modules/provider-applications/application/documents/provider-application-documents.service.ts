import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProviderApplicationStatus,
  ProviderApplicationSection,
  ProviderDocumentType,
  ReviewStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaDeliveryType,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import type { ProviderDocumentQueryDto } from '../../dto/provider-document-query.dto';
import { lockProviderApplication } from '../persistence/provider-application-lock';
import {
  assertApplicationEditable,
  SINGLETON_DOCUMENT_TYPES,
  assertProviderSectionsEditable,
} from '../../domain/provider-application.policy';
import {
  assertProviderDocumentQuota,
  providerDocumentSection,
} from '../../domain/provider-document.policy';

@Injectable()
export class ProviderApplicationDocumentsService {
  private readonly logger = new Logger(
    ProviderApplicationDocumentsService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
  ) {}

  async upload(
    applicationId: string,
    userId: string,
    type: ProviderDocumentType,
    query: ProviderDocumentQueryDto,
    buffer: Buffer,
  ) {
    const application = await this.prisma.providerApplication.findFirst({
      where: { id: applicationId, userId },
      include: { documents: true, checks: true },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    assertApplicationEditable(application.status);
    if (
      query.applicationServiceId &&
      type !== ProviderDocumentType.PROFESSIONAL_CERTIFICATE &&
      type !== ProviderDocumentType.PORTFOLIO &&
      type !== ProviderDocumentType.OTHER
    ) {
      throw new BadRequestException(
        'Chỉ chứng chỉ, portfolio hoặc tài liệu bổ sung được gắn với dịch vụ.',
      );
    }
    const section = providerDocumentSection(type);
    const existing = SINGLETON_DOCUMENT_TYPES.includes(type)
      ? application.documents.find((document) => document.type === type)
      : undefined;
    assertProviderSectionsEditable(
      application,
      [section],
      existing?.status === ReviewStatus.NEEDS_CHANGES,
    );
    assertProviderDocumentQuota(application.documents, type, Boolean(existing));
    if (query.applicationServiceId) {
      const service = await this.prisma.providerApplicationService.findFirst({
        where: {
          id: query.applicationServiceId,
          applicationId,
        },
        select: { id: true },
      });
      if (!service) {
        throw new BadRequestException(
          'Dịch vụ liên kết không thuộc hồ sơ đăng ký.',
        );
      }
    }

    const uploaded = await this.mediaStorage.uploadPrivateImage(
      buffer,
      `lambe/provider-applications/${applicationId}`,
    );
    let replacedDocument: typeof existing;
    try {
      const document = await this.prisma.$transaction(async (transaction) => {
        await lockProviderApplication(transaction, applicationId, userId);
        const current = await transaction.providerApplication.findFirst({
          where: { id: applicationId, userId },
          include: { documents: true, checks: true },
        });
        if (!current)
          throw new NotFoundException(
            'Không tìm thấy hồ sơ đăng ký nhà cung cấp.',
          );
        assertApplicationEditable(current.status);
        replacedDocument = SINGLETON_DOCUMENT_TYPES.includes(type)
          ? current.documents.find((item) => item.type === type)
          : undefined;
        assertProviderSectionsEditable(
          current,
          [section],
          replacedDocument?.status === ReviewStatus.NEEDS_CHANGES,
        );
        if (uploaded.deliveryType !== 'authenticated' || !uploaded.format)
          throw new ConflictException('Tài liệu phải được lưu trữ riêng tư.');
        if (
          query.applicationServiceId &&
          !(await transaction.providerApplicationService.findFirst({
            where: { id: query.applicationServiceId, applicationId },
            select: { id: true },
          }))
        )
          throw new BadRequestException(
            'Dịch vụ liên kết không thuộc hồ sơ đăng ký.',
          );
        assertProviderDocumentQuota(
          current.documents,
          type,
          Boolean(replacedDocument),
        );
        const result = replacedDocument
          ? await transaction.providerApplicationDocument.update({
              where: { id: replacedDocument.id },
              data: {
                fileUrl: uploaded.secureUrl,
                publicId: uploaded.publicId,
                fileFormat: uploaded.format,
                deliveryType: uploaded.deliveryType,
                applicationServiceId: query.applicationServiceId ?? null,
                status: ReviewStatus.PENDING,
                reviewNote: null,
                reviewedAt: null,
                reviewedById: null,
              },
            })
          : await transaction.providerApplicationDocument.create({
              data: {
                applicationId,
                applicationServiceId: query.applicationServiceId,
                type,
                fileUrl: uploaded.secureUrl,
                publicId: uploaded.publicId,
                fileFormat: uploaded.format,
                deliveryType: uploaded.deliveryType,
                isPublicCandidate:
                  type === ProviderDocumentType.PORTRAIT ||
                  type === ProviderDocumentType.PORTFOLIO,
              },
            });
        await this.resetSection(applicationId, section, transaction);
        return result;
      });
      if (replacedDocument) {
        await this.deleteManagedImage(
          replacedDocument.publicId,
          this.deliveryTypeOf(replacedDocument.deliveryType),
        );
      }
      return {
        success: true,
        message: replacedDocument
          ? 'Đã thay thế tài liệu trong hồ sơ.'
          : 'Đã thêm tài liệu vào hồ sơ.',
        data: this.toSafeDocument(document),
      };
    } catch (error: unknown) {
      await this.deleteManagedImage(uploaded.publicId, uploaded.deliveryType);
      throw error;
    }
  }

  async remove(applicationId: string, documentId: string, userId: string) {
    const application = await this.prisma.providerApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ đăng ký nhà cung cấp.');
    }
    assertApplicationEditable(application.status);
    const document = await this.prisma.providerApplicationDocument.findFirst({
      where: { id: documentId, applicationId },
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu.');
    if (application.status === ProviderApplicationStatus.NEEDS_CHANGES) {
      const check = await this.prisma.providerApplicationCheck.findUnique({
        where: {
          applicationId_section: {
            applicationId,
            section: providerDocumentSection(document.type),
          },
        },
      });
      if (
        document.status !== ReviewStatus.NEEDS_CHANGES &&
        check?.status !== ReviewStatus.NEEDS_CHANGES &&
        check?.status !== ReviewStatus.PENDING
      ) {
        throw new ConflictException(
          'Tài liệu đã bị khóa vì không được yêu cầu bổ sung.',
        );
      }
    }
    const removed = await this.prisma.$transaction(async (transaction) => {
      await lockProviderApplication(transaction, applicationId, userId);
      const current = await transaction.providerApplication.findFirst({
        where: { id: applicationId, userId },
        include: { checks: true },
      });
      if (!current)
        throw new NotFoundException(
          'Không tìm thấy hồ sơ đăng ký nhà cung cấp.',
        );
      assertApplicationEditable(current.status);
      const currentDocument =
        await transaction.providerApplicationDocument.findFirst({
          where: { id: documentId, applicationId },
        });
      if (!currentDocument)
        throw new NotFoundException('Không tìm thấy tài liệu.');
      const section = providerDocumentSection(currentDocument.type);
      assertProviderSectionsEditable(
        current,
        [section],
        currentDocument.status === ReviewStatus.NEEDS_CHANGES,
      );
      await transaction.providerApplicationDocument.delete({
        where: { id: documentId },
      });
      await this.resetSection(applicationId, section, transaction);
      return currentDocument;
    });
    await this.deleteManagedImage(
      removed.publicId,
      this.deliveryTypeOf(removed.deliveryType),
    );
    return { success: true, message: 'Đã xóa tài liệu khỏi hồ sơ.' };
  }

  async getApplicantAccess(
    applicationId: string,
    documentId: string,
    userId: string,
    request: RequestMetadata,
  ) {
    const document = await this.prisma.providerApplicationDocument.findFirst({
      where: { id: documentId, applicationId, application: { userId } },
      select: {
        id: true,
        publicId: true,
        fileFormat: true,
        deliveryType: true,
      },
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu.');
    const url = this.createAccessUrl(document);
    await this.audit.record(
      {
        actorUserId: userId,
        action: 'KYC_DOCUMENT_ACCESSED',
        resourceType: 'ProviderApplicationDocument',
        resourceId: document.id,
        result: 'SUCCESS',
        metadata: { applicationId },
      },
      request,
    );
    return { success: true, data: { url } };
  }

  async getInternalAccess(
    applicationId: string,
    documentId: string,
    actorId: string,
    request: RequestMetadata,
  ) {
    const document = await this.prisma.providerApplicationDocument.findFirst({
      where: { id: documentId, applicationId },
      select: {
        id: true,
        publicId: true,
        fileFormat: true,
        deliveryType: true,
      },
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu.');
    const url = this.createAccessUrl(document);
    await this.audit.record(
      {
        actorInternalAccountId: actorId,
        action: 'KYC_DOCUMENT_ACCESSED',
        resourceType: 'ProviderApplicationDocument',
        resourceId: document.id,
        result: 'SUCCESS',
        metadata: { applicationId },
      },
      request,
    );
    return { success: true, data: { url } };
  }

  private async resetSection(
    applicationId: string,
    section: ProviderApplicationSection,
    client: Pick<Prisma.TransactionClient, 'providerApplicationCheck'> = this
      .prisma,
  ): Promise<void> {
    await client.providerApplicationCheck.updateMany({
      where: { applicationId, section },
      data: {
        status: ReviewStatus.PENDING,
        reviewNote: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
  }

  private async deleteManagedImage(
    publicId: string,
    deliveryType: MediaDeliveryType,
  ): Promise<void> {
    try {
      const deleted = await this.mediaStorage.deleteImage(
        publicId,
        deliveryType,
      );
      if (!deleted)
        this.logger.warn(`Cloud image was not deleted: ${publicId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Cloud image cleanup failed for ${publicId}: ${message}`,
      );
    }
  }

  private createAccessUrl(document: {
    publicId: string;
    fileFormat: string | null;
    deliveryType: string;
  }): string {
    if (document.deliveryType !== 'authenticated' || !document.fileFormat) {
      throw new ConflictException(
        'Tài liệu cũ chưa được bảo vệ; vui lòng tải lại tài liệu.',
      );
    }
    return this.mediaStorage.createPrivateDownloadUrl(
      document.publicId,
      document.fileFormat,
    );
  }

  private deliveryTypeOf(value: string): MediaDeliveryType {
    return value === 'authenticated' ? 'authenticated' : 'upload';
  }

  private toSafeDocument<
    T extends {
      fileUrl: string;
      publicId: string;
      fileFormat: string | null;
      deliveryType: string;
    },
  >(
    document: T,
  ): Omit<T, 'fileUrl' | 'publicId' | 'fileFormat' | 'deliveryType'> {
    const {
      fileUrl: _fileUrl,
      publicId: _publicId,
      fileFormat: _fileFormat,
      deliveryType: _deliveryType,
      ...safeDocument
    } = document;
    void _fileUrl;
    void _publicId;
    void _fileFormat;
    void _deliveryType;
    return safeDocument;
  }
}
