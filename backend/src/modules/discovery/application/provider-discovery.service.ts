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
  CustomerPricePreference,
  ServiceTargetAudience,
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
  type ReviewSummary,
} from '../../orders/application/reviews/order-review.presenter';
import { OrderReviewService } from '../../orders/application/reviews/order-review.service';
import { ACCEPTED_OVERDUE_MINUTES } from '../../orders/domain/order-time.policy';
import type {
  NearbyProvidersDto,
  ProviderSearchDto,
} from '../dto/provider-search.dto';
import {
  DiscoveryCacheService,
  type CachedAreaCandidate,
  type CachedCustomerOnboarding,
  type CachedProviderServiceOffering,
  type CachedProviderSummary,
} from './discovery-cache.service';
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
    @Optional() private readonly discoveryCache?: DiscoveryCacheService,
    @Optional() private readonly reviews?: OrderReviewService,
  ) {}

  async search(
    userId: string,
    dto: ProviderSearchDto,
    excludedProviderIds?: ReadonlySet<string>,
  ) {
    const origin = await this.resolveOrigin(userId, dto);
    const [individual, organization] = await Promise.all([
      this.searchIndividuals(userId, dto, origin, excludedProviderIds),
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
    origin: { latitude: number; longitude: number },
    excludedProviderIds?: ReadonlySet<string>,
  ) {
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
    const reviewSummaries = await this.loadProviderReviewSummaries(
      ranked.map((provider) => provider.id),
    );
    const data = ranked.map(({ suggestionInput, ...provider }) => ({
      ...provider,
      reviewSummary: reviewSummaries.get(provider.id) ?? {
        count: 0,
        averageRating: null,
      },
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

    const [
      reviewSummary,
      recentReviews,
      completedOrdersCount,
      orderStats,
      portfolioPosts,
    ] = await Promise.all([
      this.prisma.orderReview.aggregate({
        where: { providerId },
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.orderReview.findMany({
        where: { providerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
      this.prisma.serviceOrder?.findMany
        ? this.prisma.serviceOrder
            .findMany({
              where: {
                providerId,
                OR: [
                  { acceptedAt: { not: null } },
                  {
                    status: {
                      in: [
                        ServiceOrderStatus.REJECTED,
                        ServiceOrderStatus.EXPIRED,
                      ],
                    },
                  },
                ],
              },
              select: {
                bookingType: true,
                acceptedAt: true,
                arrivedAt: true,
                expectedStartAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 200,
            })
            .catch(() => [])
        : Promise.resolve([]),
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

    const acceptedCount = orderStats.filter(
      (o) => o.acceptedAt !== null,
    ).length;
    const acceptanceRate =
      orderStats.length > 0
        ? Math.round((acceptedCount / orderStats.length) * 1000) / 10
        : null;
    const scheduledArrived = orderStats.filter(
      (o) => o.bookingType === BookingType.SCHEDULED && o.arrivedAt !== null,
    );
    const onTimeCount = scheduledArrived.filter(
      (o) =>
        o.arrivedAt!.getTime() <=
        o.expectedStartAt.getTime() + ACCEPTED_OVERDUE_MINUTES * 60_000,
    ).length;
    const onTimeRate =
      scheduledArrived.length > 0
        ? Math.round((onTimeCount / scheduledArrived.length) * 1000) / 10
        : null;

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
          acceptanceRate,
          onTimeRate,
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

  async nearby(userId: string, dto: NearbyProvidersDto) {
    const origin = await this.resolveOrigin(userId, dto);
    const radiusKm = dto.radiusKm ?? 30;
    const limit = dto.limit ?? 10;
    const now = new Date();

    const [onboarding, onlineCandidates, areaCandidates] = await Promise.all([
      this.loadCustomerOnboarding(userId),
      this.locations
        .findNearby(origin.latitude, origin.longitude, radiusKm, 300)
        .catch(() => []),
      this.loadAreaCandidates(origin.latitude, origin.longitude, radiusKm),
    ]);

    const mergedById = new Map<
      string,
      { providerId: string; distanceKm: number; liveOnline: boolean }
    >();
    for (const item of onlineCandidates) {
      mergedById.set(item.providerId, {
        providerId: item.providerId,
        distanceKm: item.distanceKm,
        liveOnline: true,
      });
    }
    for (const item of areaCandidates) {
      if (mergedById.has(item.providerId)) continue;
      const distanceKm = haversineKm(
        origin.latitude,
        origin.longitude,
        item.serviceAreaLatitude,
        item.serviceAreaLongitude,
      );
      if (distanceKm <= radiusKm && distanceKm <= item.serviceRadiusKm) {
        mergedById.set(item.providerId, {
          providerId: item.providerId,
          distanceKm,
          liveOnline: false,
        });
      }
    }

    if (!mergedById.size) {
      return {
        success: true,
        data: [],
        meta: {
          radiusKm,
          count: 0,
          personalized: false,
          onboardingMatchedCount: 0,
          backfilledCount: 0,
        },
      };
    }

    const summaryMap = await this.loadProviderSummaries([...mergedById.keys()]);
    const hasOnboarding = hasActiveOnboarding(onboarding);

    const eligible = [...mergedById.values()].flatMap((candidate) => {
      const summary = summaryMap.get(candidate.providerId);
      if (
        !summary ||
        summary.userId === userId ||
        summary.services.length === 0 ||
        summary.serviceRadiusKm === null ||
        candidate.distanceKm > summary.serviceRadiusKm
      ) {
        return [];
      }

      const selection = selectOfferingForOnboarding(
        summary.services,
        onboarding,
        hasOnboarding,
      );
      if (
        !this.eligibility.canReceiveNewOrder(
          summary.wallet,
          Math.ceil(selection.offering.priceAmount / 10),
        )
      ) {
        return [];
      }

      return [
        {
          candidate,
          summary,
          offering: selection.offering,
          matchedOnboarding: selection.matchedOnboarding,
        },
      ];
    });

    const onlineIds = eligible
      .filter((item) => item.candidate.liveOnline)
      .map((item) => item.summary.id);
    const calendars: Awaited<ReturnType<BookingCalendarService['read']>> =
      onlineIds.length
        ? await this.calendar.read(
            onlineIds,
            now,
            new Date(now.getTime() + DAY),
            now,
          )
        : new Map();

    const ranked = eligible
      .map(({ candidate, summary, offering, matchedOnboarding }) => {
        const durationMinutes =
          offering.durationMinutes ??
          offering.service.defaultDurationMinutes ??
          60;
        const startAt = new Date(
          now.getTime() +
            (ASAP_RESPONSE_MINUTES +
              travelMinutes(candidate.distanceKm) +
              PREPARATION_MINUTES) *
              MINUTE,
        );
        const blocks = calendars.get(summary.id) ?? [];
        const assessment = candidate.liveOnline
          ? assessSlot({
              startAt,
              durationMinutes,
              point: origin,
              hours: summary.workingHours,
              blocks,
              reservationStartAt: now,
            })
          : { available: false, reason: 'PROVIDER_OFFLINE' };
        const available =
          candidate.liveOnline &&
          assessment.available &&
          !blocks.some((block) => block.executing);
        const estimatedTravelDistanceKm = estimateTravelDistanceKm(
          candidate.distanceKm,
        );

        return {
          id: summary.id,
          providerId: summary.id,
          memberId: null,
          member: null,
          organization: null,
          providerType: summary.providerType,
          displayName: summary.displayName,
          avatarUrl: summary.avatarUrl,
          biography: summary.biography,
          experienceYears: summary.experienceYears,
          serviceAreaName: summary.serviceAreaName,
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
          suggestedSlots: [],
          requiresProviderConfirmation: true,
          estimateSource: 'CONSERVATIVE_DISTANCE',
          matchedOnboarding,
          service: {
            id: offering.id,
            priceAmount: offering.priceAmount,
            durationMinutes,
            description: offering.description,
            service: {
              id: offering.service.id,
              name: offering.service.name,
              slug: offering.service.slug,
              currencyCode: offering.service.currencyCode,
              targetAudience: offering.service.targetAudience,
              defaultDurationMinutes: offering.service.defaultDurationMinutes,
            },
          },
        };
      })
      .sort((a, b) => {
        if (hasOnboarding) {
          const matchCmp =
            Number(b.matchedOnboarding) - Number(a.matchedOnboarding);
          if (matchCmp !== 0) return matchCmp;
        }
        return (
          Number(b.available) - Number(a.available) ||
          a.distanceKm - b.distanceKm ||
          a.id.localeCompare(b.id)
        );
      })
    const sliced = ranked.slice(0, limit);
    const reviewSummaries = await this.loadProviderReviewSummaries(
      sliced.map((item) => item.id),
    );
    const data = sliced.map((item) => ({
      ...item,
      reviewSummary: reviewSummaries.get(item.id) ?? {
        count: 0,
        averageRating: null,
      },
    }));

    const onboardingMatchedCount = data.filter(
      (item) => item.matchedOnboarding,
    ).length;

    return {
      success: true,
      data,
      meta: {
        radiusKm,
        count: data.length,
        personalized: hasOnboarding,
        onboardingMatchedCount,
        backfilledCount: data.length - onboardingMatchedCount,
      },
    };
  }

  private async loadProviderReviewSummaries(
    providerIds: readonly string[],
  ): Promise<Map<string, ReviewSummary>> {
    const uniqueIds = [...new Set(providerIds)];
    const fallback = new Map<string, ReviewSummary>(
      uniqueIds.map((id) => [id, { count: 0, averageRating: null }]),
    );
    if (uniqueIds.length === 0) return fallback;
    if (this.reviews) {
      return this.reviews.providerSummaries(uniqueIds);
    }
    const groupBy = this.prisma.orderReview?.groupBy;
    if (typeof groupBy !== 'function') return fallback;
    const groups = await this.prisma.orderReview.groupBy({
      by: ['providerId'],
      where: { providerId: { in: uniqueIds } },
      _count: { id: true },
      _avg: { rating: true },
    });
    for (const group of groups) {
      fallback.set(group.providerId, {
        count: group._count.id,
        averageRating: group._avg.rating,
      });
    }
    return fallback;
  }

  private async loadCustomerOnboarding(
    userId: string,
  ): Promise<CachedCustomerOnboarding | null> {
    const cached = await this.discoveryCache?.getOnboarding(userId);
    if (cached) return cached;
    if (!this.prisma.customerProfile?.findUnique) return null;

    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: {
        onboardingStatus: true,
        preferredAudience: true,
        pricePreference: true,
        categoryInterests: { select: { categoryId: true } },
        serviceInterests: { select: { serviceId: true } },
      },
    });
    if (!profile) return null;

    const snapshot: CachedCustomerOnboarding = {
      onboardingStatus: profile.onboardingStatus,
      preferredAudience: profile.preferredAudience,
      pricePreference: profile.pricePreference,
      categoryIds: profile.categoryInterests.map((item) => item.categoryId),
      serviceIds: profile.serviceInterests.map((item) => item.serviceId),
    };
    await this.discoveryCache?.setOnboarding(userId, snapshot);
    return snapshot;
  }

  private async loadAreaCandidates(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<CachedAreaCandidate[]> {
    const cached = await this.discoveryCache?.getAreaCandidates(
      latitude,
      longitude,
      radiusKm,
    );
    if (cached) return cached;
    if (typeof this.scheduled.findAllInArea !== 'function') return [];

    const rows = await this.scheduled.findAllInArea(
      latitude,
      longitude,
      radiusKm,
    );
    await this.discoveryCache?.setAreaCandidates(
      latitude,
      longitude,
      radiusKm,
      rows,
    );
    return rows;
  }

  private async loadProviderSummaries(
    providerIds: string[],
  ): Promise<Map<string, CachedProviderSummary>> {
    const cachedMap =
      (await this.discoveryCache?.getProviderSummaries(providerIds)) ??
      new Map<string, CachedProviderSummary>();
    const missingIds = providerIds.filter((id) => !cachedMap.has(id));
    if (!missingIds.length) return cachedMap;

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        id: { in: missingIds },
        providerType: 'INDIVIDUAL',
        status: ProviderProfileStatus.ACTIVE,
        setupCompletedAt: { not: null },
        user: { status: UserStatus.ACTIVE },
        orders: { none: { status: 'SAFETY_HOLD' } },
      },
      select: {
        id: true,
        userId: true,
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
            status: ProviderServiceStatus.ACTIVE,
            service: {
              status: ServiceStatus.ACTIVE,
              category: { status: ServiceCategoryStatus.ACTIVE },
            },
          },
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
                categoryId: true,
              },
            },
          },
        },
      },
    });

    const fetched: CachedProviderSummary[] = [];
    for (const provider of providers) {
      const summary: CachedProviderSummary = {
        id: provider.id,
        userId: provider.userId,
        providerType: provider.providerType,
        displayName: provider.displayName,
        avatarUrl: provider.avatarUrl,
        biography: provider.biography,
        experienceYears: provider.experienceYears,
        serviceAreaName: provider.serviceAreaName,
        serviceRadiusKm: provider.serviceRadiusKm,
        workingHours: provider.workingHours,
        wallet: provider.wallet,
        services: provider.services.map((offering) => ({
          id: offering.id,
          priceAmount: offering.priceAmount,
          durationMinutes: offering.durationMinutes,
          description: offering.description,
          service: {
            id: offering.service.id,
            name: offering.service.name,
            slug: offering.service.slug,
            currencyCode: offering.service.currencyCode,
            targetAudience: offering.service.targetAudience,
            defaultDurationMinutes:
              offering.service.defaultDurationMinutes ?? 60,
            categoryId: offering.service.categoryId,
          },
        })),
      };
      cachedMap.set(provider.id, summary);
      fetched.push(summary);
    }
    await this.discoveryCache?.setProviderSummaries(fetched);
    return cachedMap;
  }

  private async resolveOrigin(
    userId: string,
    dto: Pick<ProviderSearchDto, 'customerAddressId' | 'latitude' | 'longitude'>,
  ) {
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

function hasActiveOnboarding(
  onboarding: CachedCustomerOnboarding | null,
): onboarding is CachedCustomerOnboarding {
  if (!onboarding) return false;
  if (onboarding.onboardingStatus === 'SKIPPED') return false;
  return (
    onboarding.categoryIds.length > 0 ||
    onboarding.serviceIds.length > 0 ||
    onboarding.preferredAudience !== ServiceTargetAudience.ALL ||
    onboarding.pricePreference !== CustomerPricePreference.NO_PREFERENCE
  );
}

function selectOfferingForOnboarding(
  offerings: CachedProviderServiceOffering[],
  onboarding: CachedCustomerOnboarding | null,
  useOnboarding: boolean,
): {
  offering: CachedProviderServiceOffering;
  matchedOnboarding: boolean;
} {
  const pricePref =
    onboarding?.pricePreference ?? CustomerPricePreference.NO_PREFERENCE;
  if (!useOnboarding || !onboarding) {
    return {
      offering: pickByPricePreference(offerings, pricePref),
      matchedOnboarding: false,
    };
  }

  const serviceSet = new Set(onboarding.serviceIds);
  const categorySet = new Set(onboarding.categoryIds);
  const hasInterestFilter = serviceSet.size > 0 || categorySet.size > 0;

  const matched = offerings.filter((item) => {
    const audienceOk =
      onboarding.preferredAudience === ServiceTargetAudience.ALL ||
      item.service.targetAudience === onboarding.preferredAudience ||
      item.service.targetAudience === ServiceTargetAudience.ALL;
    if (!audienceOk) return false;
    if (!hasInterestFilter) return true;
    return (
      serviceSet.has(item.service.id) ||
      categorySet.has(item.service.categoryId)
    );
  });

  if (matched.length > 0) {
    const sorted = [...matched].sort((a, b) => {
      const aSvc = serviceSet.has(a.service.id) ? 1 : 0;
      const bSvc = serviceSet.has(b.service.id) ? 1 : 0;
      if (bSvc !== aSvc) return bSvc - aSvc;
      return compareByPricePreference(a, b, pricePref);
    });
    return { offering: sorted[0], matchedOnboarding: true };
  }

  return {
    offering: pickByPricePreference(offerings, pricePref),
    matchedOnboarding: false,
  };
}

function pickByPricePreference(
  offerings: CachedProviderServiceOffering[],
  pricePreference: CustomerPricePreference,
): CachedProviderServiceOffering {
  return [...offerings].sort((a, b) =>
    compareByPricePreference(a, b, pricePreference),
  )[0];
}

function compareByPricePreference(
  a: CachedProviderServiceOffering,
  b: CachedProviderServiceOffering,
  pricePreference: CustomerPricePreference,
) {
  if (pricePreference === CustomerPricePreference.PREMIUM) {
    return b.priceAmount - a.priceAmount || a.id.localeCompare(b.id);
  }
  return a.priceAmount - b.priceAmount || a.id.localeCompare(b.id);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
