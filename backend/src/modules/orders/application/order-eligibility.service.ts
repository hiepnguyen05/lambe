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
  MemberServingService,
  type MemberOrigin,
  type MemberServingContext,
} from '../../provider-members/application/booking/member-serving.service';
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
import {
  calculateTravelFee,
  estimateTravelDistanceKm,
} from '../domain/travel-fee.policy';

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

export interface OrderOriginSnapshot {
  providerId: string;
  latitude: number;
  longitude: number;
  observedAt: number;
  member?: MemberOrigin;
}

@Injectable()
export class OrderEligibilityService {
  private readonly minimumReceivingBalance: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
    private readonly calendar: BookingCalendarService,
    private readonly config: ConfigService,
    private readonly members: MemberServingService,
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
      'providerServiceId' | 'customerAddressId' | 'inlineAddress' | 'memberId'
    >,
    tx: Prisma.TransactionClient = this.prisma,
    snapshotAddress?: AddressSnapshot,
    allowInactive = false,
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
        status: allowInactive ? { in: ['ACTIVE', 'INACTIVE'] } : 'ACTIVE',
        provider: {
          status: 'ACTIVE',
          setupCompletedAt: { not: null },
          user: { status: 'ACTIVE' },
          orders: { none: { status: 'SAFETY_HOLD' } },
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
    if (
      providerService.provider.providerType === 'ORGANIZATION' &&
      !dto.memberId &&
      !allowInactive
    )
      throw new BadRequestException({
        code: 'MEMBER_REQUIRED',
        message: 'Hãy chọn nhân viên thực hiện của tổ chức.',
      });
    if (providerService.provider.providerType === 'INDIVIDUAL' && dto.memberId)
      throw new BadRequestException('Đối tác cá nhân không nhận memberId.');
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
    commissionAmountOverride?: number,
    originSnapshot?: OrderOriginSnapshot,
  ) {
    const loaded = await this.load(
      customerId,
      dto,
      tx,
      snapshot?.address,
      Boolean(excludeOrderId && snapshot),
    );
    const { providerService } = loaded;
    const address = snapshot
      ? { ...loaded.address, ...snapshot.address }
      : loaded.address;
    const durationMinutes = snapshot?.durationMinutes ?? loaded.durationMinutes;
    const commissionAmount =
      snapshot?.commissionAmount ??
      commissionAmountOverride ??
      loaded.commissionAmount;
    const now = new Date();
    const provider = providerService.provider;
    // Already-created appointments are not subject to the original advance-booking lead time.
    let serviceTime =
      excludeOrderId && dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : resolveOrderTime(dto.bookingType, dto.scheduledAt, now);
    const memberContext = dto.memberId
      ? await this.members.get(
          dto.memberId,
          providerService.id,
          serviceTime,
          new Date(serviceTime.getTime() + 7 * DAY),
          tx,
          new Date(serviceTime.getTime() + durationMinutes * MINUTE),
        )
      : null;
    if (memberContext && memberContext.member.userId === customerId)
      throw new BadRequestException('Không thể tự đặt lịch cho chính mình.');
    const { distanceKm, origin } = await this.travel(
      provider,
      address,
      dto.bookingType,
      memberContext,
      originSnapshot,
      tx !== this.prisma ? tx : undefined,
    );
    if (dto.bookingType === BookingType.ASAP) {
      serviceTime = new Date(
        now.getTime() +
          (ASAP_RESPONSE_MINUTES +
            travelMinutes(distanceKm) +
            PREPARATION_MINUTES) *
            MINUTE,
      );
    }
    if (memberContext) {
      const code = this.members.blocker(
        memberContext,
        new Date(serviceTime.getTime() + durationMinutes * MINUTE),
      );
      if (code)
        throw new ConflictException({
          code,
          message:
            'Chuyên môn/chứng chỉ không hợp lệ đến hết thời gian thực hiện.',
        });
    }
    const hours = memberContext?.hours ?? provider.workingHours;
    const resourceId = memberContext?.member.id ?? provider.id;
    const blocks =
      (
        await this.calendar.read(
          [provider.id],
          dto.bookingType === BookingType.ASAP ? now : serviceTime,
          new Date(serviceTime.getTime() + 7 * DAY),
          now,
          tx,
          excludeOrderId,
          memberContext
            ? new Map([[memberContext.member.id, provider.id]])
            : undefined,
        )
      ).get(resourceId) ?? [];
    if (memberContext)
      blocks.push(
        ...memberContext.timeOffs.map((t) => ({
          startAt: t.startAt,
          endAt: t.endAt,
        })),
      );
    const assessment = assessSlot({
      startAt: serviceTime,
      durationMinutes,
      point: address,
      hours,
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
          hours,
          blocks,
          limit: 3,
        });
    const travelDistanceKm = estimateTravelDistanceKm(distanceKm);
    const travelFeeAmount = calculateTravelFee(travelDistanceKm);
    return {
      address,
      providerService,
      memberContext,
      serviceTime,
      durationMinutes,
      commissionAmount,
      reservedStartAt: dto.bookingType === BookingType.ASAP ? now : serviceTime,
      expectedEndAt: new Date(serviceTime.getTime() + durationMinutes * MINUTE),
      distanceKm: Math.round(distanceKm * 10) / 10,
      travelOrigin: origin,
      servicePriceAmount: providerService.priceAmount,
      travelDistanceKm,
      distanceSource: 'CONSERVATIVE_DISTANCE' as const,
      travelFeeAmount,
      totalAmount: providerService.priceAmount + travelFeeAmount,
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

  async captureOrigin(
    dto: Pick<OrderQuoteDto, 'providerServiceId' | 'memberId' | 'bookingType'>,
  ): Promise<OrderOriginSnapshot | undefined> {
    if (dto.bookingType !== 'ASAP') return undefined;
    const offering = await this.prisma.providerService.findUnique({
      where: { id: dto.providerServiceId },
      select: { providerId: true },
    });
    if (!offering)
      throw new NotFoundException('Không tìm thấy dịch vụ của thợ.');
    const member = dto.memberId
      ? await this.members.capturePosition(dto.memberId)
      : undefined;
    const point =
      member ?? (await this.locations.getPosition(offering.providerId));
    if (!point)
      throw new ConflictException({
        code: 'PROVIDER_OFFLINE',
        message: 'Thợ chưa bật hoạt động hoặc GPS đã hết hạn.',
      });
    return {
      ...point,
      providerId: offering.providerId,
      observedAt: Date.now(),
      member,
    };
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
    return (await this.travel(provider, address, type)).distanceKm;
  }

  private async travel(
    provider: {
      id: string;
      serviceRadiusKm: number | null;
      serviceAreaLatitude: number | null;
      serviceAreaLongitude: number | null;
    },
    address: { latitude: number; longitude: number },
    type: BookingType,
    memberContext?: MemberServingContext | null,
    snapshot?: OrderOriginSnapshot,
    transaction?: Prisma.TransactionClient,
  ) {
    if (provider.serviceRadiusKm === null)
      throw new BadRequestException('Thợ chưa cấu hình bán kính nhận đơn.');
    if (type === 'ASAP' && transaction && !snapshot)
      throw new ConflictException('Cần lấy vị trí trước khi khóa lịch.');
    if (
      snapshot &&
      (snapshot.providerId !== provider.id ||
        snapshot.observedAt < Date.now() - 30_000 ||
        (memberContext &&
          snapshot.member?.memberId !== memberContext.member.id))
    )
      throw new ConflictException('Vị trí không còn khớp người thực hiện.');
    if (snapshot?.member && memberContext)
      await this.members.assertOrigin(
        transaction ?? this.prisma,
        memberContext,
        snapshot.member,
      );
    const origin =
      type === BookingType.ASAP
        ? (snapshot ??
          (memberContext
            ? await this.members.capturePosition(memberContext.member.id)
            : await this.locations.getPosition(provider.id)))
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
    if (distance > (memberContext?.radiusKm ?? provider.serviceRadiusKm))
      throw new ConflictException({
        code: 'OUTSIDE_PROVIDER_RADIUS',
        message: 'Địa chỉ nằm ngoài bán kính nhận đơn do thợ cấu hình.',
      });
    return {
      distanceKm: distance,
      origin: { latitude: origin.latitude, longitude: origin.longitude },
    };
  }
}
