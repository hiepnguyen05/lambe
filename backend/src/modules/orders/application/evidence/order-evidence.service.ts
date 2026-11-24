import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderEvidenceType, Prisma, ServiceOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { calculateDistanceKm } from '../../../discovery/domain/distance';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../../../upload/application/media-storage.port';
import type { OrderEvidenceLocationDto } from '../../dto/order-evidence.dto';
import {
  assertAssignedMemberActive,
  providerOrderReadWhere,
  servingOrderWhere,
} from '../persistence/order-actor.policy';
import { lockBookingResource } from '../persistence/booking-resource.lock';

const allowedStatuses: Record<OrderEvidenceType, ServiceOrderStatus[]> = {
  ARRIVAL: [ServiceOrderStatus.EN_ROUTE],
  BEFORE_WORK: [ServiceOrderStatus.ARRIVED],
  AFTER_WORK: [ServiceOrderStatus.IN_PROGRESS],
  INCIDENT: [
    ServiceOrderStatus.ACCEPTED,
    ServiceOrderStatus.EN_ROUTE,
    ServiceOrderStatus.ARRIVED,
    ServiceOrderStatus.IN_PROGRESS,
  ],
};

@Injectable()
export class OrderEvidenceService {
  private readonly logger = new Logger(OrderEvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async upload(
    userId: string,
    orderId: string,
    type: OrderEvidenceType,
    location: OrderEvidenceLocationDto,
    buffer: Buffer,
  ) {
    if (
      (location.latitude === undefined) !==
      (location.longitude === undefined)
    )
      throw new BadRequestException('Cần gửi đủ vĩ độ và kinh độ.');
    if (type === OrderEvidenceType.ARRIVAL && location.latitude === undefined)
      throw new BadRequestException('Ảnh đến nơi cần tọa độ thiết bị.');
    const owned = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, ...servingOrderWhere(userId) },
      select: {
        status: true,
        providerId: true,
        assignedMemberId: true,
        assignedMemberVersion: true,
        assignedMemberUserId: true,
        addressLatitude: true,
        addressLongitude: true,
        evidence: { select: { type: true } },
      },
    });
    if (!owned) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await assertAssignedMemberActive(this.prisma, owned, userId);
    this.assertCanUpload(
      owned.status,
      type,
      owned.evidence.map((e) => e.type),
    );
    if (
      type === OrderEvidenceType.ARRIVAL &&
      location.latitude !== undefined &&
      location.longitude !== undefined &&
      calculateDistanceKm(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: owned.addressLatitude, longitude: owned.addressLongitude },
      ) > 1
    )
      throw new ConflictException(
        'Vị trí thiết bị còn cách địa chỉ khách quá xa.',
      );

    const uploaded = await this.storage.uploadPrivateImage(
      buffer,
      `lambe/orders/${orderId}`,
    );
    try {
      if (uploaded.deliveryType !== 'authenticated' || !uploaded.format)
        throw new ConflictException('Ảnh bằng chứng phải được lưu riêng tư.');
      const evidence = await this.prisma.$transaction(async (tx) => {
        await lockBookingResource(tx, owned.providerId, owned.assignedMemberId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
        );
        const current = await tx.serviceOrder.findFirst({
          where: { id: orderId, ...servingOrderWhere(userId) },
          select: {
            status: true,
            assignedMemberId: true,
            assignedMemberVersion: true,
            assignedMemberUserId: true,
            evidence: { select: { type: true } },
          },
        });
        if (!current)
          throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
        await assertAssignedMemberActive(tx, current, userId);
        this.assertCanUpload(
          current.status,
          type,
          current.evidence.map((e) => e.type),
        );
        return tx.orderEvidence.create({
          data: {
            orderId,
            uploadedByUserId: userId,
            type,
            publicId: uploaded.publicId,
            fileFormat: uploaded.format,
            latitude: location.latitude,
            longitude: location.longitude,
          },
          select: { id: true, type: true, capturedAt: true },
        });
      });
      return { success: true, data: evidence };
    } catch (error) {
      try {
        await this.storage.deleteImage(uploaded.publicId, 'authenticated');
      } catch (cleanupError) {
        this.logger.error(
          'Không thể dọn ảnh bằng chứng sau lỗi lưu DB.',
          cleanupError,
        );
      }
      throw error;
    }
  }

  async getDownload(userId: string, orderId: string, evidenceId: string) {
    const evidence = await this.prisma.orderEvidence.findFirst({
      where: {
        id: evidenceId,
        orderId,
        order: {
          OR: [{ customerId: userId }, providerOrderReadWhere(userId)],
        },
      },
      select: {
        id: true,
        type: true,
        capturedAt: true,
        publicId: true,
        fileFormat: true,
      },
    });
    if (!evidence) throw new NotFoundException('Không tìm thấy bằng chứng.');
    return {
      success: true,
      data: {
        id: evidence.id,
        type: evidence.type,
        capturedAt: evidence.capturedAt,
        url: this.storage.createPrivateDownloadUrl(
          evidence.publicId,
          evidence.fileFormat,
        ),
      },
    };
  }

  async getInternalDownload(orderId: string, evidenceId: string) {
    const evidence = await this.prisma.orderEvidence.findFirst({
      where: {
        id: evidenceId,
        orderId,
        order: { cancellationRequest: { isNot: null } },
      },
      select: { publicId: true, fileFormat: true },
    });
    if (!evidence) throw new NotFoundException('Không tìm thấy bằng chứng.');
    return {
      success: true,
      data: {
        url: this.storage.createPrivateDownloadUrl(
          evidence.publicId,
          evidence.fileFormat,
        ),
      },
    };
  }

  private assertCanUpload(
    status: ServiceOrderStatus,
    type: OrderEvidenceType,
    existing: OrderEvidenceType[],
  ) {
    if (!allowedStatuses[type].includes(status))
      throw new ConflictException('Trạng thái đơn chưa cho phép tải ảnh này.');
    if (existing.includes(type))
      throw new ConflictException('Đơn đã có ảnh bằng chứng cho bước này.');
  }
}
