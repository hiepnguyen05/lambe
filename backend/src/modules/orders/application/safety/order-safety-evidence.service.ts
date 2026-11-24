import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderSafetyIncidentStatus, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';

const MAX_IMAGES_PER_REPORTER = 5;

@Injectable()
export class OrderSafetyEvidenceService {
  private readonly logger = new Logger(OrderSafetyEvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly audit: AuditService,
  ) {}

  async upload(userId: string, orderId: string, buffer: Buffer) {
    const incident = await this.prisma.orderSafetyIncident.findFirst({
      where: {
        orderId,
        status: OrderSafetyIncidentStatus.OPEN,
        reports: { some: { reporterId: userId } },
      },
      select: { id: true },
    });
    if (!incident)
      throw new NotFoundException('Không tìm thấy sự cố đang mở của bạn.');
    const existing = await this.prisma.orderSafetyEvidence.count({
      where: { incidentId: incident.id, uploadedById: userId },
    });
    if (existing >= MAX_IMAGES_PER_REPORTER)
      throw new ConflictException('Đã đạt giới hạn ảnh bằng chứng.');

    const uploaded = await this.storage.uploadPrivateImage(
      buffer,
      `lambe/safety/${incident.id}`,
    );
    try {
      if (uploaded.deliveryType !== 'authenticated' || !uploaded.format)
        throw new ConflictException('Ảnh bằng chứng phải được lưu riêng tư.');
      const evidence = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "order_safety_incidents" WHERE "id" = ${incident.id} FOR UPDATE`,
        );
        const current = await tx.orderSafetyIncident.findFirst({
          where: {
            id: incident.id,
            status: OrderSafetyIncidentStatus.OPEN,
            reports: { some: { reporterId: userId } },
          },
          select: { id: true },
        });
        if (!current) throw new ConflictException('Sự cố đã được đóng.');
        const count = await tx.orderSafetyEvidence.count({
          where: { incidentId: incident.id, uploadedById: userId },
        });
        if (count >= MAX_IMAGES_PER_REPORTER)
          throw new ConflictException('Đã đạt giới hạn ảnh bằng chứng.');
        return tx.orderSafetyEvidence.create({
          data: {
            incidentId: incident.id,
            uploadedById: userId,
            publicId: uploaded.publicId,
            fileFormat: uploaded.format,
          },
          select: { id: true, createdAt: true },
        });
      });
      return { success: true, data: evidence };
    } catch (error) {
      try {
        await this.storage.deleteImage(uploaded.publicId, 'authenticated');
      } catch (cleanupError) {
        this.logger.error(
          'Không thể dọn ảnh sự cố sau lỗi lưu DB.',
          cleanupError,
        );
      }
      throw error;
    }
  }

  async ownDownload(userId: string, orderId: string, evidenceId: string) {
    const evidence = await this.prisma.orderSafetyEvidence.findFirst({
      where: { id: evidenceId, uploadedById: userId, incident: { orderId } },
      select: { id: true, createdAt: true, publicId: true, fileFormat: true },
    });
    if (!evidence)
      throw new NotFoundException('Không tìm thấy ảnh bằng chứng.');
    return {
      success: true,
      data: {
        id: evidence.id,
        createdAt: evidence.createdAt,
        url: this.storage.createPrivateDownloadUrl(
          evidence.publicId,
          evidence.fileFormat,
        ),
      },
    };
  }

  async staffDownload(
    staffId: string,
    incidentId: string,
    evidenceId: string,
    metadata: RequestMetadata,
  ) {
    const evidence = await this.prisma.orderSafetyEvidence.findFirst({
      where: { id: evidenceId, incidentId },
      select: { id: true, createdAt: true, publicId: true, fileFormat: true },
    });
    if (!evidence)
      throw new NotFoundException('Không tìm thấy ảnh bằng chứng.');
    await this.audit.record(
      {
        actorInternalAccountId: staffId,
        action: 'ORDER_SAFETY_EVIDENCE_ACCESSED',
        resourceType: 'OrderSafetyEvidence',
        resourceId: evidenceId,
        result: 'SUCCESS',
      },
      metadata,
    );
    return {
      success: true,
      data: {
        id: evidence.id,
        createdAt: evidence.createdAt,
        url: this.storage.createPrivateDownloadUrl(
          evidence.publicId,
          evidence.fileFormat,
        ),
      },
    };
  }
}
