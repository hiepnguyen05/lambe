import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingType, ServiceOrderStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { ObservabilityMetrics } from '../../../infrastructure/observability/observability-metrics.service';
import { ProviderDiscoveryService } from '../../discovery/application/provider-discovery.service';
import { OrderBookingService } from '../../orders/application/booking/order-booking.service';
import type { CreateOrderDto } from '../../orders/dto/order.dto';
import { resolveOrderTime } from '../../orders/domain/order-time.policy';
import type {
  RematchCandidatesQueryDto,
  RetryOrderDto,
} from '../dto/rematch.dto';

@Injectable()
export class RematchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: ProviderDiscoveryService,
    private readonly booking: OrderBookingService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
  ) {}

  async candidates(
    customerId: string,
    orderId: string,
    query: RematchCandidatesQueryDto,
  ) {
    const source = await this.loadSource(customerId, orderId);
    const tried = await this.prisma.serviceOrder.findMany({
      where: { bookingGroupId: source.bookingGroupId },
      select: { providerId: true, assignedMemberId: true },
    });
    const triedIds = new Set(
      tried.map((order) =>
        order.assignedMemberId
          ? `${order.providerId}:${order.assignedMemberId}`
          : order.providerId,
      ),
    );
    const result = await this.discovery.search(
      customerId,
      {
        serviceId: source.providerService.serviceId,
        latitude: source.addressLatitude,
        longitude: source.addressLongitude,
        bookingType: source.bookingType,
        scheduledAt: source.scheduledAt?.toISOString(),
        radiusKm: query.radiusKm ?? 10,
        limit: query.limit ?? 20,
      },
      triedIds,
    );
    if (result.data.some((candidate) => candidate.available))
      this.metrics?.recordEvent('rematch', 'offered');
    return {
      success: true,
      data: {
        sourceOrderId: source.id,
        bookingGroupId: source.bookingGroupId,
        orderDraft: {
          serviceId: source.providerService.serviceId,
          ...this.orderDraft(source),
        },
        service: source.providerService.service,
        candidates: result.data,
      },
      meta: { ...result.meta, excludedProviders: triedIds.size },
    };
  }

  async retry(
    customerId: string,
    orderId: string,
    dto: RetryOrderDto,
    request: RequestMetadata,
    idempotencyKey: string,
  ) {
    // Booking.create checks the idempotency key before validating the current
    // attempt. A network retry must still return its already-created order.
    const source = await this.loadSource(customerId, orderId, false);
    const order: CreateOrderDto = {
      ...this.orderDraft(source),
      providerServiceId: dto.providerServiceId,
      memberId: dto.memberId,
      quoteToken: dto.quoteToken,
      voucherCode: dto.voucherCode,
    };
    return this.booking.create(
      customerId,
      order,
      request,
      idempotencyKey,
      orderId,
    );
  }

  private async loadSource(
    customerId: string,
    orderId: string,
    requireLatest = true,
  ) {
    const source = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, customerId },
      select: {
        id: true,
        status: true,
        bookingGroupId: true,
        bookingType: true,
        scheduledAt: true,
        addressLabel: true,
        addressLine: true,
        addressProvinceName: true,
        addressDistrictName: true,
        addressWardName: true,
        addressStreetLine: true,
        addressLatitude: true,
        addressLongitude: true,
        addressNote: true,
        contactName: true,
        contactPhone: true,
        customerNote: true,
        providerService: {
          select: {
            serviceId: true,
            service: {
              select: {
                id: true,
                code: true,
                name: true,
                slug: true,
                description: true,
                iconUrl: true,
                coverImageUrl: true,
                minPriceAmount: true,
                maxPriceAmount: true,
                currencyCode: true,
                defaultDurationMinutes: true,
                targetAudience: true,
                requiresCertificate: true,
                minExperienceYears: true,
                category: {
                  select: { id: true, code: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    if (
      source.status !== ServiceOrderStatus.REJECTED &&
      source.status !== ServiceOrderStatus.EXPIRED
    )
      throw new ConflictException('Đơn chưa đủ điều kiện tìm thợ khác.');
    if (requireLatest) {
      const latest = await this.prisma.serviceOrder.findFirst({
        where: { bookingGroupId: source.bookingGroupId },
        orderBy: { bookingAttempt: 'desc' },
        select: { id: true },
      });
      if (latest?.id !== source.id)
        throw new ConflictException('Đã có lần đặt mới cho nhu cầu này.');
      if (source.bookingType === BookingType.SCHEDULED)
        resolveOrderTime(source.bookingType, source.scheduledAt?.toISOString());
    }
    return source;
  }

  private orderDraft(
    source: Awaited<ReturnType<RematchService['loadSource']>>,
  ) {
    return {
      bookingType: source.bookingType,
      scheduledAt: source.scheduledAt?.toISOString(),
      inlineAddress: {
        label: source.addressLabel,
        addressLine: source.addressLine,
        latitude: source.addressLatitude,
        longitude: source.addressLongitude,
        provinceName: source.addressProvinceName ?? undefined,
        districtName: source.addressDistrictName ?? undefined,
        wardName: source.addressWardName ?? undefined,
        streetLine: source.addressStreetLine ?? undefined,
        note: source.addressNote ?? undefined,
      },
      contactName: source.contactName ?? undefined,
      contactPhone: source.contactPhone ?? undefined,
      customerNote: source.customerNote ?? undefined,
    };
  }
}
