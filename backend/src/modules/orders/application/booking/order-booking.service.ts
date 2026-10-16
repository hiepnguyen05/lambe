import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { ChatService } from '../../../chat/application/chat.service';
import type { CreateOrderDto, OrderQuoteDto } from '../../dto/order.dto';
import {
  ASAP_RESPONSE_MINUTES,
  SCHEDULE_RESPONSE_MINUTES,
  MINUTE,
} from '../../domain/booking-calendar.policy';
import { OrderEligibilityService } from '../order-eligibility.service';
import {
  orderInclude,
  presentForCustomer,
} from '../persistence/order.presenter';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';

export function bookingRequestHash(dto: CreateOrderDto): string {
  if (
    dto.scheduledAt !== undefined &&
    (dto.bookingType === 'ASAP' ||
      typeof dto.scheduledAt !== 'string' ||
      !Number.isFinite(Date.parse(dto.scheduledAt)))
  )
    throw new BadRequestException('scheduledAt không hợp lệ.');
  return createHash('sha256')
    .update(
      JSON.stringify({
        providerServiceId: dto.providerServiceId,
        customerAddressId: dto.customerAddressId ?? null,
        inlineAddress: dto.inlineAddress ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        bookingType: dto.bookingType,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt).toISOString()
          : null,
        customerNote: dto.customerNote?.trim() || null,
      }),
    )
    .digest('hex');
}

@Injectable()
export class OrderBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: OrderEligibilityService,
    private readonly calendar: BookingCalendarService,
    private readonly audit: AuditService,
    private readonly chat: ChatService,
  ) {}

  async quote(customerId: string, dto: OrderQuoteDto) {
    const p = await this.eligibility.prepare(customerId, dto);
    return {
      success: true,
      data: {
        bookingType: dto.bookingType,
        scheduledAt: dto.bookingType === 'SCHEDULED' ? p.serviceTime : null,
        expectedStartAt: p.serviceTime,
        expectedEndAt: p.expectedEndAt,
        provider: {
          id: p.providerService.providerId,
          displayName: p.providerService.provider.displayName,
        },
        providerServiceId: p.providerService.id,
        serviceName: p.providerService.service.name,
        servicePriceAmount: p.servicePriceAmount,
        travelFeeAmount: p.travelFeeAmount,
        totalAmount: p.totalAmount,
        currencyCode: p.providerService.service.currencyCode,
        durationMinutes: p.durationMinutes,
        distanceKm: p.distanceKm,
        available: p.available,
        reason: p.reason,
        suggestedSlots: p.suggestedSlots,
        estimateSource: p.estimateSource,
        requiresProviderConfirmation: true,
      },
    };
  }

  async create(
    customerId: string,
    dto: CreateOrderDto,
    request: RequestMetadata,
    idempotencyKey: string,
  ) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey ?? ''))
      throw new BadRequestException(
        'Cần Idempotency-Key từ 8 đến 128 ký tự chữ, số, _ hoặc -.',
      );
    const hash = bookingRequestHash(dto);
    const order = await this.prisma.$transaction(
      async (tx) => {
        // Serialize retries for this customer, then provider, then order/wallet throughout the module.
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${customerId}`}, 0))::text AS locked`,
        );
        const previous = await tx.serviceOrder.findUnique({
          where: {
            customerId_clientRequestId: {
              customerId,
              clientRequestId: idempotencyKey,
            },
          },
          include: orderInclude,
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'Idempotency-Key đã dùng cho nội dung đặt lịch khác.',
            });
          return previous;
        }
        const target = await tx.providerService.findUnique({
          where: { id: dto.providerServiceId },
          select: { providerId: true },
        });
        if (!target)
          throw new NotFoundException('Không tìm thấy dịch vụ của thợ.');
        await this.calendar.lockProvider(tx, target.providerId);
        const now = new Date();
        await this.calendar.releaseExpired(tx, target.providerId, now);
        const pendingCount = await tx.serviceOrder.count({
          where: {
            customerId,
            status: 'PENDING_PROVIDER',
            providerResponseDeadlineAt: { gt: now },
          },
        });
        if (pendingCount >= 3)
          throw new ConflictException({
            code: 'TOO_MANY_PENDING_ORDERS',
            message:
              'Bạn đang có 3 yêu cầu chờ phản hồi. Hãy xử lý trước khi đặt tiếp.',
          });
        const p = await this.eligibility.prepare(customerId, dto, tx);
        this.eligibility.assertAvailable(p);
        const customer = await tx.user.findUniqueOrThrow({
          where: { id: customerId },
          select: { fullName: true, phone: true },
        });
        const contactName =
          dto.contactName ?? p.address.contactName ?? customer.fullName;
        if (!contactName)
          throw new BadRequestException('Cần họ tên người nhận dịch vụ.');
        const deadline = new Date(
          dto.bookingType === 'ASAP'
            ? now.getTime() + ASAP_RESPONSE_MINUTES * MINUTE
            : Math.min(
                now.getTime() + SCHEDULE_RESPONSE_MINUTES * MINUTE,
                p.serviceTime.getTime() - 15 * MINUTE,
              ),
        );
        const created = await tx.serviceOrder.create({
          data: {
            customerId,
            providerId: target.providerId,
            providerServiceId: p.providerService.id,
            customerAddressId: p.address.id || null,
            bookingType: dto.bookingType,
            scheduledAt: dto.bookingType === 'SCHEDULED' ? p.serviceTime : null,
            expectedStartAt: p.serviceTime,
            expectedEndAt: p.expectedEndAt,
            clientRequestId: idempotencyKey,
            requestHash: hash,
            serviceName: p.providerService.service.name,
            servicePriceAmount: p.servicePriceAmount,
            travelFeeAmount: p.travelFeeAmount,
            totalAmount: p.totalAmount,
            currencyCode: p.providerService.service.currencyCode,
            durationMinutes: p.durationMinutes,
            commissionRateBps: p.commissionRateBps,
            commissionAmount: p.commissionAmount,
            addressLabel: p.address.label,
            addressLine: p.address.addressLine,
            addressProvinceName: p.address.provinceName,
            addressDistrictName: p.address.districtName,
            addressWardName: p.address.wardName,
            addressStreetLine: p.address.streetLine,
            addressLatitude: p.address.latitude,
            addressLongitude: p.address.longitude,
            contactName,
            contactPhone:
              dto.contactPhone ?? p.address.contactPhone ?? customer.phone,
            addressNote: p.address.note,
            customerNote: dto.customerNote,
            providerResponseDeadlineAt: deadline,
            calendarBlock: {
              create: {
                providerId: target.providerId,
                startAt: p.reservedStartAt,
                endAt: p.expectedEndAt,
                addressLatitude: p.address.latitude,
                addressLongitude: p.address.longitude,
                holdExpiresAt: deadline,
              },
            },
            statusHistory: {
              create: { toStatus: 'PENDING_PROVIDER', actorUserId: customerId },
            },
          },
          include: orderInclude,
        });
        created.conversationId = await this.chat.attachOrder(tx, created);
        await this.audit.record(
          {
            actorUserId: customerId,
            action: 'SERVICE_ORDER_CREATED',
            resourceType: 'ServiceOrder',
            resourceId: created.id,
            result: 'SUCCESS',
            metadata: { bookingType: dto.bookingType },
          },
          request,
          tx,
        );
        await tx.orderNotification.create({
          data: {
            userId: p.providerService.provider.userId,
            orderId: created.id,
            event: 'ORDER_REQUESTED',
          },
        });
        return created;
      },
      { maxWait: 5000, timeout: 10000 },
    );
    return {
      success: true,
      message: 'Đã gửi yêu cầu đặt dịch vụ tới nhà cung cấp.',
      data: presentForCustomer(order),
    };
  }
}
