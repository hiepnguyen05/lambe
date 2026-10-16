import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingType, Prisma } from '@prisma/client';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { calculateDistanceKm } from '../../discovery/domain/distance';
import type { OrderQuoteDto } from '../dto/order.dto';
import { resolveOrderTime } from '../domain/order-time.policy';
import {
  assessSlot,
  suggestSlots,
  MINUTE,
  DAY,
  travelMinutes,
  PREPARATION_MINUTES,
  ASAP_RESPONSE_MINUTES,
  SCHEDULE_LEAD_MINUTES,
} from '../domain/booking-calendar.policy';
import { BookingCalendarService } from './scheduling/booking-calendar.service';
import { hasReceivingBalance } from '../../providers/domain/provider-receiving.policy';

export const DEFAULT_COMMISSION_RATE_BPS = 1000;
const addressSelect = {
  id: true,
  latitude: true,
  longitude: true,
  label: true,
  addressLine: true,
  provinceName: true,
  districtName: true,
  wardName: true,
  streetLine: true,
  contactName: true,
  contactPhone: true,
  note: true,
} satisfies Prisma.CustomerAddressSelect;
type AddressSnapshot = Prisma.CustomerAddressGetPayload<{
  select: typeof addressSelect;
}>;

@Injectable()
export class OrderEligibilityService {
  private readonly minimumReceivingBalance: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
    private readonly calendar: BookingCalendarService,
    private readonly config: ConfigService,
  ) {
    this.minimumReceivingBalance = this.config.get<number>(
      'provider.minReceivingBalanceAmount',
      50_000,
    );
  }

  canReceiveNewOrder(
    wallet: { balanceAmount: number; heldAmount: number } | null,
    commissionAmount: number,
  ): boolean {
    return hasReceivingBalance(
      wallet,
      commissionAmount,
      this.minimumReceivingBalance,
    );
  }

  async load(
    customerId: string,
    dto: Pick<
      OrderQuoteDto,
      'providerServiceId' | 'customerAddressId' | 'inlineAddress'
    >,
    tx: Prisma.TransactionClient = this.prisma,
    snapshotAddress?: AddressSnapshot,
  ) {
    if (
      !snapshotAddress &&
      Boolean(dto.customerAddressId) === Boolean(dto.inlineAddress)
    )
      throw new BadRequestException(
        'Chọn một địa chỉ đã lưu hoặc nhập địa chỉ mới.',
      );
    const address =
      snapshotAddress ??
      (dto.inlineAddress
        ? {
            id: '',
            label: dto.inlineAddress.label,
            addressLine: dto.inlineAddress.addressLine,
            provinceName: dto.inlineAddress.provinceName ?? null,
            districtName: dto.inlineAddress.districtName ?? null,
            wardName: dto.inlineAddress.wardName ?? null,
            streetLine: dto.inlineAddress.streetLine ?? null,
            latitude: dto.inlineAddress.latitude,
            longitude: dto.inlineAddress.longitude,
            contactName: null,
            contactPhone: null,
            note: dto.inlineAddress.note ?? null,
          }
        : await tx.customerAddress.findFirst({
            where: { id: dto.customerAddressId, userId: customerId },
            select: addressSelect,
          }));
    if (!address)
      throw new NotFoundException('Không tìm thấy địa chỉ của khách hàng.');
    const providerService = await tx.providerService.findFirst({
      where: {
        id: dto.providerServiceId,
        status: 'ACTIVE',
        provider: {
          status: 'ACTIVE',
          setupCompletedAt: { not: null },
          user: { status: 'ACTIVE' },
        },
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      include: {
        service: true,
        provider: { include: { workingHours: true, wallet: true } },
      },
    });
    if (!providerService)
      throw new NotFoundException(
        'Không tìm thấy dịch vụ đang hoạt động của nhà cung cấp.',
      );
    if (providerService.provider.userId === customerId)
      throw new BadRequestException('Không thể tự đặt dịch vụ của mình.');
    const durationMinutes =
      providerService.durationMinutes ??
      providerService.service.defaultDurationMinutes ??
      60;
    const commissionAmount = Math.ceil(
      (providerService.priceAmount * DEFAULT_COMMISSION_RATE_BPS) / 10_000,
    );
    return { address, providerService, durationMinutes, commissionAmount };
  }

  async prepare(
    customerId: string,
    dto: OrderQuoteDto,
    tx: Prisma.TransactionClient = this.prisma,
    excludeOrderId?: string,
    snapshot?: {
      durationMinutes: number;
      commissionAmount: number;
      address: AddressSnapshot;
    },
  ) {
    const loaded = await this.load(customerId, dto, tx, snapshot?.address);
    const { providerService } = loaded;
    const address = snapshot
      ? { ...loaded.address, ...snapshot.address }
      : loaded.address;
    const durationMinutes = snapshot?.durationMinutes ?? loaded.durationMinutes;
    const commissionAmount =
      snapshot?.commissionAmount ?? loaded.commissionAmount;
    const now = new Date();
    const provider = providerService.provider;
    // Already-created appointments are not subject to the original advance-booking lead time.
    let serviceTime =
      excludeOrderId && dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : resolveOrderTime(dto.bookingType, dto.scheduledAt, now);
    const distanceKm = await this.distance(provider, address, dto.bookingType);
    if (dto.bookingType === BookingType.ASAP) {
      serviceTime = new Date(
        now.getTime() +
          (ASAP_RESPONSE_MINUTES +
            travelMinutes(distanceKm) +
            PREPARATION_MINUTES) *
            MINUTE,
      );
    }
    const blocks =
      (
        await this.calendar.read(
          [provider.id],
          dto.bookingType === BookingType.ASAP ? now : serviceTime,
          new Date(serviceTime.getTime() + 7 * DAY),
          now,
          tx,
          excludeOrderId,
        )
      ).get(provider.id) ?? [];
    const assessment = assessSlot({
      startAt: serviceTime,
      durationMinutes,
      point: address,
      hours: provider.workingHours,
      blocks,
      reservationStartAt:
        dto.bookingType === BookingType.ASAP ? now : undefined,
    });
    const busyNow =
      dto.bookingType === BookingType.ASAP &&
      blocks.some((block) => block.executing);
    const canReceiveNewOrder = this.canReceiveNewOrder(
      provider.wallet,
      commissionAmount,
    );
    const available = assessment.available && !busyNow && canReceiveNewOrder;
    const reason = busyNow
      ? 'PROVIDER_BUSY'
      : !canReceiveNewOrder
        ? 'PROVIDER_NOT_ACCEPTING_ORDERS'
        : assessment.reason;
    const suggestions = available
      ? []
      : suggestSlots({
          startAt: new Date(
            Math.max(
              serviceTime.getTime(),
              now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE,
            ),
          ),
          until: new Date(
            Math.min(now.getTime() + 30 * DAY, serviceTime.getTime() + 7 * DAY),
          ),
          durationMinutes,
          point: address,
          hours: provider.workingHours,
          blocks,
          limit: 3,
        });
    return {
      address,
      providerService,
      serviceTime,
      durationMinutes,
      commissionAmount,
      reservedStartAt: dto.bookingType === BookingType.ASAP ? now : serviceTime,
      expectedEndAt: new Date(serviceTime.getTime() + durationMinutes * MINUTE),
      distanceKm: Math.round(distanceKm * 10) / 10,
      servicePriceAmount: providerService.priceAmount,
      travelFeeAmount: 0,
      totalAmount: providerService.priceAmount,
      commissionRateBps: DEFAULT_COMMISSION_RATE_BPS,
      available,
      reason,
      suggestedSlots: canReceiveNewOrder ? suggestions : [],
      estimateSource: 'CONSERVATIVE_DISTANCE' as const,
    };
  }

  assertAvailable(
    prepared: Awaited<ReturnType<OrderEligibilityService['prepare']>>,
  ) {
    if (!prepared.available)
      throw new ConflictException({
        code: prepared.reason,
        message:
          'Thợ chưa thể nhận đơn vào thời gian này. Vui lòng chọn giờ khác.',
        suggestedSlots: prepared.suggestedSlots,
      });
  }

  async assertOnline(providerId: string) {
    if (!(await this.locations.getPosition(providerId)))
      throw new ConflictException({
        code: 'PROVIDER_OFFLINE',
        message: 'Hãy bật hoạt động và cập nhật vị trí trước khi khởi hành.',
      });
  }

  async distance(
    provider: {
      id: string;
      serviceRadiusKm: number | null;
      serviceAreaLatitude: number | null;
      serviceAreaLongitude: number | null;
    },
    address: { latitude: number; longitude: number },
    type: BookingType,
  ) {
    if (provider.serviceRadiusKm === null)
      throw new BadRequestException('Thợ chưa cấu hình bán kính nhận đơn.');
    const origin =
      type === BookingType.ASAP
        ? await this.locations.getPosition(provider.id)
        : provider.serviceAreaLatitude !== null &&
            provider.serviceAreaLongitude !== null
          ? {
              latitude: provider.serviceAreaLatitude,
              longitude: provider.serviceAreaLongitude,
            }
          : null;
    if (!origin)
      throw new ConflictException({
        code:
          type === BookingType.ASAP
            ? 'PROVIDER_OFFLINE'
            : 'SERVICE_AREA_NOT_CONFIGURED',
        message: 'Thợ chưa sẵn sàng nhận đơn theo hình thức này.',
      });
    const distance = calculateDistanceKm(origin, address);
    if (distance > provider.serviceRadiusKm)
      throw new ConflictException({
        code: 'OUTSIDE_PROVIDER_RADIUS',
        message: 'Địa chỉ nằm ngoài bán kính nhận đơn do thợ cấu hình.',
      });
    return distance;
  }
}
