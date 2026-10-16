import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  UserStatus,
  BookingType,
} from '@prisma/client';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderSearchDto } from '../dto/provider-search.dto';
import { ScheduledProviderCandidatesService } from './scheduled-provider-candidates.service';
import { BookingCalendarService } from '../../orders/application/scheduling/booking-calendar.service';
import { OrderEligibilityService } from '../../orders/application/order-eligibility.service';
import { resolveOrderTime } from '../../orders/domain/order-time.policy';
import {
  assessSlot,
  suggestSlots,
  DAY,
  MINUTE,
  travelMinutes,
  PREPARATION_MINUTES,
  ASAP_RESPONSE_MINUTES,
  SCHEDULE_LEAD_MINUTES,
} from '../../orders/domain/booking-calendar.policy';

@Injectable()
export class ProviderDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
    private readonly calendar: BookingCalendarService,
    private readonly scheduled: ScheduledProviderCandidatesService,
    private readonly eligibility: OrderEligibilityService,
  ) {}

  async search(userId: string, dto: ProviderSearchDto) {
    const origin = await this.resolveOrigin(userId, dto);
    const radiusKm = dto.radiusKm ?? 10;
    const limit = dto.limit ?? 20;
    const now = new Date();
    const bookingType = dto.bookingType ?? BookingType.ASAP;
    const requestedTime = resolveOrderTime(bookingType, dto.scheduledAt, now);
    const candidates =
      bookingType === BookingType.SCHEDULED
        ? await this.scheduled.find(
            dto.serviceId,
            origin.latitude,
            origin.longitude,
            radiusKm,
          )
        : await this.locations.findNearby(
            origin.latitude,
            origin.longitude,
            radiusKm,
            300,
          );
    if (!candidates.length) {
      return {
        success: true,
        data: [],
        meta: {
          radiusKm,
          count: 0,
          bookingType,
          candidateLimit: 300,
          searchLimited: false,
        },
      };
    }

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        id: { in: candidates.map((item) => item.providerId) },
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: { not: null },
        user: { status: UserStatus.ACTIVE },
        userId: { not: userId },
      },
      select: {
        id: true,
        providerType: true,
        displayName: true,
        avatarUrl: true,
        biography: true,
        experienceYears: true,
        serviceAreaName: true,
        serviceRadiusKm: true,
        workingHours: {
          select: { dayOfWeek: true, startMinute: true, endMinute: true },
        },
        wallet: { select: { balanceAmount: true, heldAmount: true } },
        services: {
          where: {
            serviceId: dto.serviceId,
            status: ProviderServiceStatus.ACTIVE,
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
          take: 1,
          select: {
            id: true,
            priceAmount: true,
            durationMinutes: true,
            description: true,
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                currencyCode: true,
                targetAudience: true,
                defaultDurationMinutes: true,
              },
            },
          },
        },
      },
    });
    const providerMap = new Map(
      providers.map((provider) => [provider.id, provider]),
    );
    const calendars = await this.calendar.read(
      providers.map((provider) => provider.id),
      bookingType === BookingType.ASAP ? now : requestedTime,
      new Date(requestedTime.getTime() + DAY),
      now,
    );

    const data = candidates
      .flatMap((candidate) => {
        const provider = providerMap.get(candidate.providerId);
        if (
          !provider ||
          provider.services.length === 0 ||
          provider.serviceRadiusKm === null ||
          candidate.distanceKm > provider.serviceRadiusKm
        ) {
          return [];
        }

        const service = provider.services[0];
        if (
          !this.eligibility.canReceiveNewOrder(
            provider.wallet,
            Math.ceil(service.priceAmount / 10),
          )
        )
          return [];
        const durationMinutes =
          service.durationMinutes ??
          service.service.defaultDurationMinutes ??
          60;
        const blocks = calendars.get(provider.id) ?? [];
        const startAt =
          bookingType === BookingType.ASAP
            ? new Date(
                now.getTime() +
                  (ASAP_RESPONSE_MINUTES +
                    travelMinutes(candidate.distanceKm) +
                    PREPARATION_MINUTES) *
                    MINUTE,
              )
            : requestedTime;
        const assessment = assessSlot({
          startAt,
          durationMinutes,
          point: origin,
          hours: provider.workingHours,
          blocks,
          reservationStartAt:
            bookingType === BookingType.ASAP ? now : undefined,
        });
        const available =
          assessment.available &&
          !(
            bookingType === BookingType.ASAP &&
            blocks.some((block) => block.executing)
          );
        const suggestedSlots = available
          ? []
          : suggestSlots({
              startAt: new Date(
                Math.max(
                  startAt.getTime(),
                  now.getTime() + SCHEDULE_LEAD_MINUTES * MINUTE,
                ),
              ),
              until: new Date(
                Math.min(
                  now.getTime() + 30 * DAY,
                  requestedTime.getTime() + DAY,
                ),
              ),
              durationMinutes,
              point: origin,
              hours: provider.workingHours,
              blocks,
              limit: 3,
            });

        return [
          {
            id: provider.id,
            providerType: provider.providerType,
            displayName: provider.displayName,
            avatarUrl: provider.avatarUrl,
            biography: provider.biography,
            experienceYears: provider.experienceYears,
            serviceAreaName: provider.serviceAreaName,
            distanceKm: Math.round(candidate.distanceKm * 10) / 10,
            available,
            reason: available ? null : (assessment.reason ?? 'PROVIDER_BUSY'),
            expectedStartAt: startAt,
            expectedEndAt: new Date(
              startAt.getTime() + durationMinutes * MINUTE,
            ),
            suggestedSlots,
            requiresProviderConfirmation: true,
            estimateSource: 'CONSERVATIVE_DISTANCE',
            service: provider.services[0],
          },
        ];
      })
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          a.distanceKm - b.distanceKm ||
          a.id.localeCompare(b.id),
      )
      .slice(0, limit);

    return {
      success: true,
      data,
      meta: {
        radiusKm,
        count: data.length,
        bookingType,
        candidateLimit: 300,
        searchLimited: candidates.length >= 300,
      },
    };
  }

  async findPublicProfile(providerId: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: providerId,
        status: ProviderProfileStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        providerType: true,
        displayName: true,
        avatarUrl: true,
        biography: true,
        experienceYears: true,
        serviceAreaName: true,
        workingHours: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
          select: { dayOfWeek: true, startMinute: true, endMinute: true },
        },
        services: {
          where: {
            status: ProviderServiceStatus.ACTIVE,
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            priceAmount: true,
            durationMinutes: true,
            description: true,
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                coverImageUrl: true,
                currencyCode: true,
                targetAudience: true,
                category: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException(
        'Không tìm thấy nhà cung cấp đang hoạt động.',
      );
    }
    const online = await this.locations
      .isOnline(provider.id)
      .catch(() => false);
    return { success: true, data: { ...provider, online } };
  }

  private async resolveOrigin(userId: string, dto: ProviderSearchDto) {
    if (dto.customerAddressId) {
      const address = await this.prisma.customerAddress.findFirst({
        where: { id: dto.customerAddressId, userId },
        select: { latitude: true, longitude: true },
      });
      if (!address)
        throw new NotFoundException('Không tìm thấy địa chỉ của khách hàng.');
      return address;
    }

    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw new BadRequestException(
        'Cần cung cấp customerAddressId hoặc đầy đủ latitude và longitude.',
      );
    }
    return { latitude: dto.latitude, longitude: dto.longitude };
  }
}
