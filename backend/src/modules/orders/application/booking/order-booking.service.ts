import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { ChatService } from '../../../chat/application/chat.service';
import type { CreateOrderDto, OrderQuoteDto } from '../../dto/order.dto';
import {
  PROVIDER_RESPONSE_TIMEOUT_MS,
  MINUTE,
} from '../../domain/booking-calendar.policy';
import { OrderEligibilityService } from '../order-eligibility.service';
import {
  createdOrderInclude,
  presentForCustomer,
} from '../persistence/order.presenter';
import { OrderNotificationRelayService } from '../notifications/order-notification-relay.service';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';
import { VoucherService } from '../pricing/voucher.service';
import { OsrmRoutingService } from '../tracking/osrm-routing.service';
import { calculateTravelFee } from '../../domain/travel-fee.policy';
import { calculateDistanceKm } from '../../../discovery/domain/distance';
import { ObservabilityMetrics } from '../../../../infrastructure/observability/observability-metrics.service';

interface BookingQuoteToken {
  purpose: 'booking-quote';
  customerId: string;
  memberId?: string | null;
  membershipVersion?: number | null;
  requestHash: string;
  providerPriceAmount: number;
  travelDistanceKm: number;
  distanceSource: string;
  travelFeeAmount: number;
  totalAmount: number;
  origin: { latitude: number; longitude: number };
  addressHash: string;
}

function addressHash(address: {
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  provinceName?: string | null;
  districtName?: string | null;
  wardName?: string | null;
  streetLine?: string | null;
  note?: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        address.label,
        address.addressLine,
        address.latitude,
        address.longitude,
        address.provinceName ?? null,
        address.districtName ?? null,
        address.wardName ?? null,
        address.streetLine ?? null,
        address.note ?? null,
      ]),
    )
    .digest('hex');
}

function quoteRequestHash(dto: OrderQuoteDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        providerServiceId: dto.providerServiceId,
        memberId: dto.memberId ?? null,
        customerAddressId: dto.customerAddressId ?? null,
        inlineAddress: dto.inlineAddress
          ? addressHash(dto.inlineAddress)
          : null,
        bookingType: dto.bookingType,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt).toISOString()
          : null,
        voucherCode: dto.voucherCode?.trim().toUpperCase() || null,
      }),
    )
    .digest('hex');
}

export function bookingRequestHash(
  dto: CreateOrderDto,
  retryOfOrderId?: string,
): string {
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
        memberId: dto.memberId ?? null,
        customerAddressId: dto.customerAddressId ?? null,
        inlineAddress: dto.inlineAddress ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        bookingType: dto.bookingType,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt).toISOString()
          : null,
        customerNote: dto.customerNote?.trim() || null,
        voucherCode: dto.voucherCode?.trim().toUpperCase() || null,
        ...(retryOfOrderId ? { retryOfOrderId } : {}),
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
    private readonly vouchers: VoucherService,
    private readonly routing: OsrmRoutingService,
    private readonly jwt: JwtService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
    @Optional()
    private readonly notificationRelay?: OrderNotificationRelayService,
  ) {}

  async quote(customerId: string, dto: OrderQuoteDto) {
    let p = await this.eligibility.prepare(customerId, dto);
    const distanceMeters = await this.routing.getDistanceMeters(
      p.travelOrigin,
      p.address,
    );
    const travelDistanceKm =
      distanceMeters !== null
        ? Math.ceil(distanceMeters / 100) / 10
        : p.travelDistanceKm;
    const travelFeeAmount = calculateTravelFee(travelDistanceKm);
    const price = await this.vouchers.price(customerId, dto.voucherCode, {
      providerId: p.providerService.providerId,
      serviceId: p.providerService.serviceId,
      servicePriceAmount: p.servicePriceAmount,
      serviceFloorAmount: p.providerService.service.minPriceAmount,
      travelFeeAmount,
    });
    if (
      p.reason === 'PROVIDER_NOT_ACCEPTING_ORDERS' &&
      price.commissionAmount < p.commissionAmount
    ) {
      p = await this.eligibility.prepare(
        customerId,
        dto,
        this.prisma,
        undefined,
        undefined,
        price.commissionAmount,
      );
    }
    const quoteToken = p.available
      ? await this.jwt.signAsync(
          {
            purpose: 'booking-quote',
            customerId,
            memberId: p.memberContext?.member.id ?? null,
            membershipVersion:
              p.memberContext?.member.membershipVersion ?? null,
            requestHash: quoteRequestHash(dto),
            providerPriceAmount: p.servicePriceAmount,
            travelDistanceKm,
            distanceSource:
              distanceMeters !== null ? 'OSRM' : 'CONSERVATIVE_DISTANCE',
            travelFeeAmount,
            totalAmount: price.totalAmount,
            origin: p.travelOrigin,
            addressHash: addressHash(p.address),
          } satisfies BookingQuoteToken,
          { expiresIn: '5m', audience: 'booking-quote' },
        )
      : null;
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
        memberId: p.memberContext?.member.id ?? null,
        member: p.memberContext
          ? {
              id: p.memberContext.member.id,
              displayName:
                p.memberContext.member.displayName ??
                p.memberContext.member.user.fullName ??
                'Chuyên viên',
              avatarUrl:
                p.memberContext.member.avatarUrl ??
                p.memberContext.member.user.avatarUrl,
            }
          : null,
        serviceName: p.providerService.service.name,
        servicePriceAmount: p.servicePriceAmount,
        travelFeeAmount,
        travelDistanceKm,
        distanceSource:
          distanceMeters !== null ? 'OSRM' : 'CONSERVATIVE_DISTANCE',
        quoteToken,
        subtotalAmount: price.subtotalAmount,
        discountAmount: price.discountAmount,
        voucherCode: price.voucherCode,
        voucherIssuer: price.voucherIssuer,
        totalAmount: price.totalAmount,
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
    retryOfOrderId?: string,
  ) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey ?? ''))
      throw new BadRequestException(
        'Cần Idempotency-Key từ 8 đến 128 ký tự chữ, số, _ hoặc -.',
      );
    const hash = bookingRequestHash(dto, retryOfOrderId);

    // Parallel pre-tx checks: verify quoteToken, resolve target offering & capture ASAP live origin
    // before acquiring database advisory locks.
    const expectedQuoteHash = quoteRequestHash(dto);
    const [preloaded, verifiedQuote] = await Promise.all([
      this.prisma.providerService
        .findUnique({
          where: { id: dto.providerServiceId },
          select: { providerId: true, serviceId: true },
        })
        .then(async (row) => {
          if (!row) return { target: null, liveOrigin: undefined };
          try {
            const liveOrigin = await this.eligibility.captureOrigin(
              dto,
              row.providerId,
            );
            return { target: row, liveOrigin };
          } catch (err: unknown) {
            return { target: row, liveOrigin: { error: err } as const };
          }
        }),
      this.jwt
        .verifyAsync<BookingQuoteToken>(dto.quoteToken, {
          audience: 'booking-quote',
        })
        .catch(() => null),
    ]);
    const target = preloaded.target;
    const liveOrigin = preloaded.liveOrigin;

    let createdNew = false;
    let notifyRecipientId: string | null = null;
    let notifyRecordId: string | null = null;
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
          include: createdOrderInclude,
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'Idempotency-Key đã dùng cho nội dung đặt lịch khác.',
            });
          return previous;
        }
        if (liveOrigin && 'error' in liveOrigin) {
          throw liveOrigin.error;
        }
        if (!verifiedQuote) {
          throw new ConflictException({
            code: 'QUOTE_EXPIRED',
            message: 'Báo giá đã hết hạn. Vui lòng lấy báo giá mới.',
          });
        }
        const quoted = verifiedQuote;
        if (
          quoted.purpose !== 'booking-quote' ||
          quoted.customerId !== customerId ||
          quoted.requestHash !== expectedQuoteHash ||
          !Number.isFinite(quoted.travelDistanceKm) ||
          quoted.travelDistanceKm < 0 ||
          !quoted.origin ||
          !['OSRM', 'CONSERVATIVE_DISTANCE'].includes(quoted.distanceSource)
        )
          throw new ConflictException({
            code: 'QUOTE_MISMATCH',
            message: 'Nội dung đơn khác báo giá đã xác nhận.',
          });
        if (!target)
          throw new NotFoundException('Không tìm thấy dịch vụ của thợ.');
        let matchedRetrySource: {
          bookingGroupId: string;
          bookingAttempt: number;
        } | null = null;
        if (retryOfOrderId) {
          const retrySource = await tx.serviceOrder.findFirst({
            where: { id: retryOfOrderId, customerId },
            select: {
              id: true,
              status: true,
              bookingGroupId: true,
              bookingAttempt: true,
              providerService: { select: { serviceId: true } },
            },
          });
          if (!retrySource)
            throw new NotFoundException('Không tìm thấy đơn cần đặt lại.');
          if (!['REJECTED', 'EXPIRED'].includes(retrySource.status))
            throw new ConflictException('Đơn chưa đủ điều kiện tìm thợ khác.');
          const [latest, tried] = await Promise.all([
            tx.serviceOrder.findFirst({
              where: { bookingGroupId: retrySource.bookingGroupId },
              orderBy: { bookingAttempt: 'desc' },
              select: { id: true },
            }),
            tx.serviceOrder.count({
              where: {
                bookingGroupId: retrySource.bookingGroupId,
                providerId: target.providerId,
                assignedMemberId: dto.memberId ?? null,
              },
            }),
          ]);
          if (latest?.id !== retrySource.id)
            throw new ConflictException('Đã có lần đặt mới cho nhu cầu này.');
          if (target.serviceId !== retrySource.providerService.serviceId)
            throw new ConflictException('Dịch vụ mới không khớp đơn trước.');
          if (tried)
            throw new ConflictException(
              'Chuyên viên này đã được thử trước đó.',
            );
          matchedRetrySource = retrySource;
        }
        await this.calendar.lockProvider(tx, target.providerId, dto.memberId);
        const now = new Date();
        await this.calendar.releaseExpired(tx, target.providerId, now);
        const [pendingCount, customer, initialPrepared] = await Promise.all([
          tx.serviceOrder.count({
            where: {
              customerId,
              status: 'PENDING_PROVIDER',
              providerResponseDeadlineAt: { gt: now },
            },
          }),
          tx.user.findUniqueOrThrow({
            where: { id: customerId },
            select: { fullName: true, phone: true },
          }),
          this.eligibility.prepare(
            customerId,
            dto,
            tx,
            undefined,
            undefined,
            undefined,
            liveOrigin,
          ),
        ]);
        if (pendingCount >= 3)
          throw new ConflictException({
            code: 'TOO_MANY_PENDING_ORDERS',
            message:
              'Bạn đang có 3 yêu cầu chờ phản hồi. Hãy xử lý trước khi đặt tiếp.',
          });
        let p = initialPrepared;
        if (
          (quoted.memberId ?? null) !== (p.memberContext?.member.id ?? null) ||
          (quoted.membershipVersion ?? null) !==
            (p.memberContext?.member.membershipVersion ?? null)
        )
          throw new ConflictException({
            code: 'QUOTE_CHANGED',
            message: 'Tư cách nhân viên đã thay đổi. Vui lòng lấy báo giá mới.',
          });
        const originMovedKm = calculateDistanceKm(
          p.travelOrigin,
          quoted.origin,
        );
        if (originMovedKm > 0.5)
          throw new ConflictException({
            code: 'QUOTE_CHANGED',
            message: 'Vị trí thợ đã thay đổi. Vui lòng lấy báo giá mới.',
          });
        if (p.servicePriceAmount !== quoted.providerPriceAmount)
          throw new ConflictException({
            code: 'QUOTE_CHANGED',
            message: 'Giá dịch vụ đã thay đổi. Vui lòng lấy báo giá mới.',
          });
        if (addressHash(p.address) !== quoted.addressHash)
          throw new ConflictException({
            code: 'QUOTE_CHANGED',
            message: 'Địa chỉ đã thay đổi. Vui lòng lấy báo giá mới.',
          });
        const price = await this.vouchers.price(
          customerId,
          dto.voucherCode,
          {
            providerId: p.providerService.providerId,
            serviceId: p.providerService.serviceId,
            servicePriceAmount: p.servicePriceAmount,
            serviceFloorAmount: p.providerService.service.minPriceAmount,
            travelFeeAmount: quoted.travelFeeAmount,
          },
          tx,
          true,
        );
        if (
          p.reason === 'PROVIDER_NOT_ACCEPTING_ORDERS' &&
          price.commissionAmount < p.commissionAmount
        ) {
          p = await this.eligibility.prepare(
            customerId,
            dto,
            tx,
            undefined,
            undefined,
            price.commissionAmount,
            liveOrigin,
          );
        }
        if (
          price.totalAmount !== quoted.totalAmount ||
          calculateTravelFee(quoted.travelDistanceKm) !== quoted.travelFeeAmount
        )
          throw new ConflictException({
            code: 'QUOTE_CHANGED',
            message: 'Báo giá đã thay đổi. Vui lòng lấy báo giá mới.',
          });
        this.eligibility.assertAvailable(p);
        if (
          !this.eligibility.canReceiveNewOrder(
            p.providerService.provider.wallet,
            price.commissionAmount,
          )
        )
          throw new ConflictException(
            'Ví thợ không đủ điều kiện nhận đơn với giá đã chốt.',
          );
        const contactName =
          dto.contactName ?? p.address.contactName ?? customer.fullName;
        if (!contactName)
          throw new BadRequestException('Cần họ tên người nhận dịch vụ.');
        const deadline = new Date(
          dto.bookingType === 'ASAP'
            ? now.getTime() + PROVIDER_RESPONSE_TIMEOUT_MS
            : Math.min(
                now.getTime() + PROVIDER_RESPONSE_TIMEOUT_MS,
                p.serviceTime.getTime() - 15 * MINUTE,
              ),
        );
        const createdRecord = await tx.serviceOrder.create({
          data: {
            ...(matchedRetrySource
              ? {
                  bookingGroupId: matchedRetrySource.bookingGroupId,
                  bookingAttempt: matchedRetrySource.bookingAttempt + 1,
                }
              : {}),
            customerId,
            providerId: target.providerId,
            assignedMemberId: p.memberContext?.member.id ?? null,
            assignedMemberVersion:
              p.memberContext?.member.membershipVersion ?? null,
            assignedMemberUserId: p.memberContext?.member.userId ?? null,
            assignedMemberName: p.memberContext
              ? (p.memberContext.member.displayName ??
                p.memberContext.member.user.fullName ??
                'Chuyên viên')
              : null,
            assignedMemberAvatarUrl: p.memberContext
              ? (p.memberContext.member.avatarUrl ??
                p.memberContext.member.user.avatarUrl)
              : null,
            providerDisplayName: p.providerService.provider.displayName,
            providerAvatarUrl: p.providerService.provider.avatarUrl,
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
            travelFeeAmount: quoted.travelFeeAmount,
            travelDistanceKm: quoted.travelDistanceKm,
            distanceSource: quoted.distanceSource,
            subtotalAmount: price.subtotalAmount,
            discountAmount: price.discountAmount,
            voucherCode: price.voucherCode,
            voucherIssuer: price.voucherIssuer,
            platformFundedAmount: price.platformFundedAmount,
            providerFundedAmount: price.providerFundedAmount,
            totalAmount: price.totalAmount,
            currencyCode: p.providerService.service.currencyCode,
            durationMinutes: p.durationMinutes,
            commissionRateBps: p.commissionRateBps,
            commissionAmount: price.commissionAmount,
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
                memberId: p.memberContext?.member.id ?? null,
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
          include: { statusHistory: createdOrderInclude.statusHistory },
        });
        // These snapshots were already validated/read under the booking lock.
        const created = {
          ...createdRecord,
          provider: {
            id: p.providerService.provider.id,
            userId: p.providerService.provider.userId,
            displayName: p.providerService.provider.displayName,
            avatarUrl: p.providerService.provider.avatarUrl,
            serviceRadiusKm: p.providerService.provider.serviceRadiusKm,
          },
          customer: { id: customerId, ...customer },
          providerService: {
            id: p.providerService.id,
            serviceId: p.providerService.serviceId,
            service: {
              id: p.providerService.serviceId,
              iconUrl: p.providerService.service.iconUrl,
              coverImageUrl: p.providerService.service.coverImageUrl,
              category: p.providerService.service.category,
            },
          },
        };
        if (price.voucherId) {
          await tx.voucherRedemption.create({
            data: {
              voucherId: price.voucherId,
              customerId,
              orderId: created.id,
              amount: price.discountAmount,
            },
          });
        }
        created.conversationId = await this.chat.attachOrder(tx, created, {
          providerUserId: p.providerService.provider.userId,
          assignedMemberId: created.assignedMemberId,
          assignedMemberUserId: created.assignedMemberUserId,
          assignedMemberVersion: created.assignedMemberVersion,
          isNewOrder: true,
        });
        notifyRecipientId =
          created.assignedMemberUserId ?? p.providerService.provider.userId;
        const [, notice] = await Promise.all([
          this.audit.record(
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
          ),
          tx.orderNotification.create({
            data: {
              userId: notifyRecipientId,
              orderId: created.id,
              event: 'ORDER_REQUESTED',
            },
            select: { id: true },
          }),
        ]);
        notifyRecordId = notice.id;
        createdNew = true;
        return created;
      },
      { maxWait: 5000, timeout: 10000 },
    );
    if (order.conversationId) {
      this.chat.notifyOrderAttached(order.conversationId);
    }
    if (notifyRecipientId) {
      void this.notificationRelay?.publishNow(
        notifyRecipientId,
        notifyRecordId ?? undefined,
      );
    }
    if (createdNew && retryOfOrderId)
      this.metrics?.recordEvent('rematch', 'selected');
    return {
      success: true,
      message: 'Đã gửi yêu cầu đặt dịch vụ tới nhà cung cấp.',
      data: presentForCustomer(order),
    };
  }
}
