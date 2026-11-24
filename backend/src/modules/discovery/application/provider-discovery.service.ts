import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import {
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  UserStatus,
  BookingType,
  ServiceOrderStatus,
} from '@prisma/client';
import {
  PROVIDER_LOCATION_STORE,
  type ProviderLocationStore,
} from '../../../infrastructure/location/provider-location.store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { publicFeedWhere } from '../../social-feed/domain/feed-visibility.policy';
import { CloudinaryService } from '../../../infrastructure/upload/cloudinary.service';
import { feedMediaUrl } from '../../social-feed/application/feed-media-url';
import {
  presentReview,
  publicReviewSelect,
} from '../../orders/application/reviews/order-review.presenter';
import type { ProviderSearchDto } from '../dto/provider-search.dto';
import { MemberDiscoveryService } from './member-discovery.service';
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
import {
  calculateTravelFee,
  estimateTravelDistanceKm,
} from '../../orders/domain/travel-fee.policy';

@Injectable()
export class ProviderDiscoveryService {
  @Optional()
  @Inject(CloudinaryService)
  private readonly feedStorage?: CloudinaryService;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_LOCATION_STORE)
    private readonly locations: ProviderLocationStore,
    private readonly calendar: BookingCalendarService,
    private readonly scheduled: ScheduledProviderCandidatesService,
    private readonly eligibility: OrderEligibilityService,
    private readonly members: MemberDiscoveryService,
  ) {}

  async search(
    userId: string,
    dto: ProviderSearchDto,
    excludedProviderIds?: ReadonlySet<string>,
  ) {
    const origin = await this.resolveOrigin(userId, dto);
    const [individual, organization] = await Promise.all([
      this.searchIndividuals(userId, dto, excludedProviderIds),
      this.members.search(userId, dto, origin, excludedProviderIds),
    ]);
    const data = [...individual.data, ...organization.data]
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          a.distanceKm - b.distanceKm ||
          (a.memberId ?? a.id).localeCompare(b.memberId ?? b.id),
      )
      .slice(0, dto.limit ?? 20);
    return {
      success: true,
      data,
      meta: {
        ...individual.meta,
        count: data.length,
        candidateLimit: 600,
        searchLimited:
          individual.meta.searchLimited || organization.searchLimited,
      },
    };
  }

  private async searchIndividuals(
    userId: string,
    dto: ProviderSearchDto,
    excludedProviderIds?: ReadonlySet<string>,
  ) {
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
    const eligibleCandidates = excludedProviderIds
      ? candidates.filter(
          (candidate) => !excludedProviderIds.has(candidate.providerId),
        )
      : candidates;
    if (dto.memberId) eligibleCandidates.length = 0;
    if (!eligibleCandidates.length) {
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
        id: { in: eligibleCandidates.map((item) => item.providerId) },
        providerType: 'INDIVIDUAL',
        ...(dto.providerId ? { AND: [{ id: dto.providerId }] } : {}),
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: { not: null },
        user: { status: UserStatus.ACTIVE },
        userId: { not: userId },
        orders: { none: { status: 'SAFETY_HOLD' } },
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

    const ranked = eligibleCandidates
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
        const suggestionInput = available
          ? null
          : {
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
            };
        const estimatedTravelDistanceKm = estimateTravelDistanceKm(
          candidate.distanceKm,
        );

        return [
          {
            id: provider.id,
            providerId: provider.id,
            memberId: null,
            member: null,
            organization: null,
            providerType: provider.providerType,
            displayName: provider.displayName,
            avatarUrl: provider.avatarUrl,
            biography: provider.biography,
            experienceYears: provider.experienceYears,
            serviceAreaName: provider.serviceAreaName,
            distanceKm: Math.round(candidate.distanceKm * 10) / 10,
            estimatedTravelDistanceKm,
            estimatedTravelFeeAmount: calculateTravelFee(
              estimatedTravelDistanceKm,
            ),
            available,
            reason: available ? null : (assessment.reason ?? 'PROVIDER_BUSY'),
            expectedStartAt: startAt,
            expectedEndAt: new Date(
              startAt.getTime() + durationMinutes * MINUTE,
            ),
            suggestionInput,
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
    const data = ranked.map(({ suggestionInput, ...provider }) => ({
      ...provider,
      suggestedSlots: suggestionInput ? suggestSlots(suggestionInput) : [],
    }));

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
        serviceRadiusKm: true,
        _count: { select: { orders: { where: { status: 'SAFETY_HOLD' } } } },
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
                iconUrl: true,
                coverImageUrl: true,
                currencyCode: true,
                targetAudience: true,
                category: {
                  select: { name: true, slug: true, iconUrl: true },
                },
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
    const { _count, ...publicProvider } = provider;
    const online =
      _count.orders === 0 &&
      (provider.providerType === 'ORGANIZATION'
        ? await this.members.isOrganizationOnline(provider.id)
        : await this.locations.isOnline(provider.id).catch(() => false));

    const [reviewSummary, recentReviews, completedOrdersCount, portfolioPosts] =
      await Promise.all([
        this.prisma.orderReview.aggregate({
          where: { providerId },
          _count: { id: true },
          _avg: { rating: true },
        }),
        this.prisma.orderReview.findMany({
          where: { providerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            ...publicReviewSelect,
            customer: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        }),
        this.prisma.serviceOrder
          ? this.prisma.serviceOrder
              .count({
                where: { providerId, status: ServiceOrderStatus.COMPLETED },
              })
              .catch(() => 0)
          : Promise.resolve(0),
        this.prisma.feedPost
          ? this.prisma.feedPost
              .findMany({
                where: { providerId, ...publicFeedWhere },
                orderBy: { createdAt: 'desc' },
                take: 6,
                select: {
                  id: true,
                  caption: true,
                  createdAt: true,
                  media: {
                    orderBy: { position: 'asc' },
                    take: 1,
                    select: {
                      id: true,
                      secureUrl: true,
                      kind: true,
                      publicId: true,
                      format: true,
                      deliveryType: true,
                    },
                  },
                  _count: {
                    select: {
                      likes: true,
                    },
                  },
                },
              })
              .catch(() => [])
          : Promise.resolve([]),
      ]);

    return {
      success: true,
      data: {
        ...publicProvider,
        serviceRadiusKm: provider.serviceRadiusKm ?? 5,
        online,
        stats: {
          rating: reviewSummary._avg.rating,
          reviewCount: reviewSummary._count.id,
          completedOrdersCount,
          acceptanceRate: 98.5,
          onTimeRate: 99.0,
        },
        reviews: recentReviews.map((r) => ({
          ...presentReview(r),
          createdAt: r.createdAt.toISOString(),
          customerName: r.customer?.fullName ?? 'Khách hàng',
          customerAvatar: r.customer?.avatarUrl,
        })),
        portfolio: portfolioPosts.map((p) => ({
          id: p.id,
          title: p.caption,
          imageUrl: p.media[0]
            ? feedMediaUrl(p.media[0], this.feedStorage)
            : '',
          likesCount: p._count.likes,
        })),
      },
    };
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
