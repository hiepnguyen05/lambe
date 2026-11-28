import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CustomerOnboardingStatus,
  CustomerPricePreference,
  ServiceTargetAudience,
} from '@prisma/client';
import { DiscoveryCacheService } from './discovery-cache.service';
import { ProviderDiscoveryService } from './provider-discovery.service';
import * as bookingCalendarPolicy from '../../orders/domain/booking-calendar.policy';

function context() {
  const provider = {
    id: 'provider-id',
    providerType: 'INDIVIDUAL',
    displayName: 'Minh Anh',
    avatarUrl: null,
    biography: 'Hair stylist',
    experienceYears: 5,
    serviceAreaName: 'Quận 1',
    _count: { orders: 0 },
    serviceAreaLatitude: 10.7731,
    serviceAreaLongitude: 106.703,
    serviceRadiusKm: 10,
    wallet: { balanceAmount: 100000, heldAmount: 0 },
    workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startMinute: 0,
      endMinute: 1440,
    })),
    services: [
      {
        id: 'provider-service-id',
        priceAmount: 150_000,
        durationMinutes: 60,
        description: null,
        service: {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Cắt tóc nữ',
          slug: 'cat-toc-nu',
          currencyCode: 'VND',
          targetAudience: 'WOMEN',
        },
      },
    ],
  };
  const prisma = {
    orderReview: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _count: { id: 0 }, _avg: { rating: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customerAddress: {
      findFirst: jest.fn().mockResolvedValue({
        latitude: 10.7731,
        longitude: 106.703,
      }),
    },
    providerProfile: {
      findMany: jest.fn().mockResolvedValue([provider]),
      findFirst: jest.fn().mockResolvedValue(provider),
    },
  };
  const locations = {
    findNearby: jest
      .fn()
      .mockResolvedValue([{ providerId: provider.id, distanceKm: 1.26 }]),
    isOnline: jest.fn().mockResolvedValue(true),
  };
  return {
    service: new ProviderDiscoveryService(
      prisma as never,
      locations as never,
      { read: jest.fn().mockResolvedValue(new Map()) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {
        canReceiveNewOrder: jest.fn(
          (
            wallet: { balanceAmount: number; heldAmount: number } | null,
            commission: number,
          ) =>
            !!wallet &&
            wallet.balanceAmount - wallet.heldAmount >=
              Math.max(50_000, commission),
        ),
      } as never,
      {
        search: jest.fn().mockResolvedValue({ data: [], searchLimited: false }),
      } as never,
    ),
    prisma,
    locations,
    provider,
  };
}

describe('ProviderDiscoveryService', () => {
  const query = {
    serviceId: '00000000-0000-4000-8000-000000000001',
    customerAddressId: '00000000-0000-4000-8000-000000000002',
  };

  it('returns online providers in distance order without exposing coordinates', async () => {
    const { service } = context();
    const response = await service.search('user-id', query);

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      id: 'provider-id',
      distanceKm: 1.3,
      estimatedTravelDistanceKm: 1.9,
      estimatedTravelFeeAmount: 0,
    });
    expect(response.data[0]).not.toHaveProperty('serviceAreaLatitude');
    expect(response.data[0]).not.toHaveProperty('serviceAreaLongitude');
  });

  it('excludes providers whose order is on safety hold', async () => {
    const { service, prisma } = context();
    await service.search('user-id', query);
    const lookup = (
      prisma.providerProfile.findMany.mock.calls as unknown[][]
    )[0]?.[0];
    expect(lookup).toMatchObject({
      where: { orders: { none: { status: 'SAFETY_HOLD' } } },
    });
  });

  it('does not advertise a safety-held provider as online on the public profile', async () => {
    const { service, provider, locations } = context();
    provider._count.orders = 1;
    const response = await service.findPublicProfile(provider.id);
    expect(response.data.online).toBe(false);
    expect(response.data).not.toHaveProperty('_count');
    expect(locations.isOnline).not.toHaveBeenCalled();
  });

  it('filters online providers outside their configured receiving radius', async () => {
    const { service, locations } = context();
    locations.findNearby.mockResolvedValue([
      { providerId: 'provider-id', distanceKm: 10.1 },
    ]);
    const response = await service.search('user-id', query);
    expect(response.data).toEqual([]);
  });

  it('filters providers whose available wallet balance is below 50,000 VND', async () => {
    const { service, provider } = context();
    provider.wallet = { balanceAmount: 49_999, heldAmount: 0 };

    const response = await service.search('user-id', query);

    expect(response.data).toEqual([]);
  });

  it('rejects an address that does not belong to the current customer', async () => {
    const { service, prisma } = context();
    prisma.customerAddress.findFirst.mockResolvedValue(null);
    await expect(service.search('user-id', query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires either a saved address or a complete coordinate pair', async () => {
    const { service } = context();
    await expect(
      service.search('user-id', { serviceId: query.serviceId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates suggested slots only for providers returned in the page', async () => {
    const { service, prisma, locations, provider } = context();
    const providers = Array.from({ length: 4 }, (_, index) => ({
      ...provider,
      id: `provider-${index}`,
      workingHours: [],
    }));
    prisma.providerProfile.findMany.mockResolvedValue(providers);
    locations.findNearby.mockResolvedValue(
      providers.map((item, index) => ({
        providerId: item.id,
        distanceKm: index + 1,
      })),
    );
    const suggestions = jest.spyOn(bookingCalendarPolicy, 'suggestSlots');
    try {
      const response = await service.search('user-id', { ...query, limit: 1 });
      expect(response.data).toHaveLength(1);
      expect(response.data[0].id).toBe('provider-0');
      expect(suggestions).toHaveBeenCalledTimes(1);
    } finally {
      suggestions.mockRestore();
    }
  });
});

describe('ProviderDiscoveryService.nearby (home + onboarding + redis cache)', () => {
  const fullHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startMinute: 0,
    endMinute: 1440,
  }));

  function nearbyContext(options?: {
    onboarding?: {
      onboardingStatus: CustomerOnboardingStatus;
      preferredAudience: ServiceTargetAudience;
      pricePreference: CustomerPricePreference;
      categoryIds: string[];
      serviceIds: string[];
    } | null;
    providers?: Array<{
      id: string;
      distanceKm: number;
      online: boolean;
      categoryId: string;
      serviceId: string;
      targetAudience?: ServiceTargetAudience;
      priceAmount?: number;
    }>;
    cacheStore?: Record<string, jest.Mock>;
  }) {
    const providerList = options?.providers ?? [];
    const dbProviders = providerList.map((item) => ({
      id: item.id,
      userId: `user-${item.id}`,
      providerType: 'INDIVIDUAL',
      displayName: `Thợ ${item.id}`,
      avatarUrl: null,
      biography: null,
      experienceYears: 3,
      serviceAreaName: 'Quận 1',
      serviceRadiusKm: 20,
      workingHours: fullHours,
      wallet: { balanceAmount: 200_000, heldAmount: 0 },
      services: [
        {
          id: `ps-${item.id}`,
          priceAmount: item.priceAmount ?? 150_000,
          durationMinutes: 60,
          description: null,
          service: {
            id: item.serviceId,
            name: 'Dịch vụ mẫu',
            slug: 'dich-vu-mau',
            currencyCode: 'VND',
            targetAudience: item.targetAudience ?? ServiceTargetAudience.ALL,
            defaultDurationMinutes: 60,
            categoryId: item.categoryId,
          },
        },
      ],
    }));

    const prisma = {
      customerAddress: {
        findFirst: jest.fn().mockResolvedValue({
          latitude: 10.7731,
          longitude: 106.703,
        }),
      },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(
          options?.onboarding
            ? {
                onboardingStatus: options.onboarding.onboardingStatus,
                preferredAudience: options.onboarding.preferredAudience,
                pricePreference: options.onboarding.pricePreference,
                categoryInterests: options.onboarding.categoryIds.map(
                  (categoryId) => ({ categoryId }),
                ),
                serviceInterests: options.onboarding.serviceIds.map(
                  (serviceId) => ({ serviceId }),
                ),
              }
            : null,
        ),
      },
      providerProfile: {
        findMany: jest.fn().mockResolvedValue(dbProviders),
      },
    };

    const locations = {
      findNearby: jest.fn().mockResolvedValue(
        providerList
          .filter((item) => item.online)
          .map((item) => ({
            providerId: item.id,
            distanceKm: item.distanceKm,
          })),
      ),
    };

    const scheduled = {
      find: jest.fn().mockResolvedValue([]),
      findAllInArea: jest.fn().mockResolvedValue(
        providerList
          .filter((item) => !item.online)
          .map((item) => ({
            providerId: item.id,
            // ~0.009 deg latitude ~ 1 km per unit
            serviceAreaLatitude: 10.7731 + item.distanceKm * 0.00899,
            serviceAreaLongitude: 106.703,
            serviceRadiusKm: 20,
          })),
      ),
    };

    const cacheStore = options?.cacheStore ?? {
      get: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockImplementation((keys: string[]) =>
        Promise.resolve(keys.map(() => null)),
      ),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const discoveryCache = new DiscoveryCacheService(cacheStore as never);

    const service = new ProviderDiscoveryService(
      prisma as never,
      locations as never,
      { read: jest.fn().mockResolvedValue(new Map()) } as never,
      scheduled as never,
      { canReceiveNewOrder: jest.fn().mockReturnValue(true) } as never,
      { search: jest.fn() } as never,
      discoveryCache,
    );

    return { service, prisma, locations, scheduled, cacheStore };
  }

  it('prioritizes onboarding matches and auto-backfills up to 10 nearest specialists', async () => {
    const { service } = nearbyContext({
      onboarding: {
        onboardingStatus: CustomerOnboardingStatus.COMPLETED,
        preferredAudience: ServiceTargetAudience.WOMEN,
        pricePreference: CustomerPricePreference.BUDGET,
        categoryIds: ['cat-nail'],
        serviceIds: [],
      },
      providers: [
        {
          id: 'p-far-match',
          distanceKm: 4.5,
          online: true,
          categoryId: 'cat-nail',
          serviceId: 'srv-nail',
        },
        {
          id: 'p-close-other',
          distanceKm: 0.5,
          online: true,
          categoryId: 'cat-hair',
          serviceId: 'srv-hair',
        },
        {
          id: 'p-offline-match',
          distanceKm: 2.0,
          online: false,
          categoryId: 'cat-nail',
          serviceId: 'srv-nail',
        },
        {
          id: 'p-mid-other',
          distanceKm: 1.5,
          online: false,
          categoryId: 'cat-spa',
          serviceId: 'srv-spa',
        },
      ],
    });

    const response = await service.nearby('user-id', {
      latitude: 10.7731,
      longitude: 106.703,
      limit: 10,
    });

    expect(response.data.map((p) => p.id)).toEqual([
      'p-far-match', // matched onboarding + online
      'p-offline-match', // matched onboarding + offline
      'p-close-other', // backfilled + online
      'p-mid-other', // backfilled + offline
    ]);
    expect(response.meta).toMatchObject({
      count: 4,
      personalized: true,
      onboardingMatchedCount: 2,
      backfilledCount: 2,
    });
    expect(response.data[0]).not.toHaveProperty('serviceAreaLatitude');
  });

  it('returns top 10 nearest specialists when customer has no onboarding', async () => {
    const providers = Array.from({ length: 12 }, (_, index) => ({
      id: `p-${String(12 - index).padStart(2, '0')}`,
      distanceKm: (12 - index) * 0.5,
      online: true,
      categoryId: 'cat-hair',
      serviceId: 'srv-hair',
    }));
    const { service } = nearbyContext({ onboarding: null, providers });

    const response = await service.nearby('user-id', {
      latitude: 10.7731,
      longitude: 106.703,
      limit: 10,
    });

    expect(response.data).toHaveLength(10);
    expect(response.data[0].id).toBe('p-01');
    expect(response.data[9].id).toBe('p-10');
    expect(response.meta).toMatchObject({
      personalized: false,
      onboardingMatchedCount: 0,
      backfilledCount: 10,
    });
  });

  it('uses Redis caches (onboarding, quantized geo cell, MGET summaries) and fails open on Redis error', async () => {
    const cachedSummary = {
      id: 'p-cached',
      userId: 'user-p-cached',
      providerType: 'INDIVIDUAL',
      displayName: 'Thợ Cache',
      avatarUrl: null,
      biography: null,
      experienceYears: 4,
      serviceAreaName: 'Quận 1',
      serviceRadiusKm: 20,
      workingHours: fullHours,
      wallet: { balanceAmount: 150_000, heldAmount: 0 },
      services: [
        {
          id: 'ps-cached',
          priceAmount: 100_000,
          durationMinutes: 45,
          description: null,
          service: {
            id: 'srv-1',
            name: 'Cắt tóc',
            slug: 'cat-toc',
            currencyCode: 'VND',
            targetAudience: ServiceTargetAudience.ALL,
            defaultDurationMinutes: 45,
            categoryId: 'cat-1',
          },
        },
      ],
    };

    const cacheStore = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key.includes(':onboarding:')) {
          return Promise.resolve({
            onboardingStatus: CustomerOnboardingStatus.SKIPPED,
            preferredAudience: ServiceTargetAudience.ALL,
            pricePreference: CustomerPricePreference.NO_PREFERENCE,
            categoryIds: [],
            serviceIds: [],
          });
        }
        if (key.includes(':area:')) {
          return Promise.resolve([
            {
              providerId: 'p-cached',
              serviceAreaLatitude: 10.782,
              serviceAreaLongitude: 106.703,
              serviceRadiusKm: 20,
            },
          ]);
        }
        return Promise.resolve(null);
      }),
      getMany: jest.fn().mockResolvedValue([cachedSummary]),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const { service, prisma, scheduled } = nearbyContext({
      providers: [],
      cacheStore,
    });

    const hitResponse = await service.nearby('user-id', {
      latitude: 10.7731,
      longitude: 106.703,
    });
    expect(hitResponse.data).toHaveLength(1);
    expect(hitResponse.data[0].id).toBe('p-cached');
    expect(prisma.customerProfile.findUnique).not.toHaveBeenCalled();
    expect(scheduled.findAllInArea).not.toHaveBeenCalled();
    expect(prisma.providerProfile.findMany).not.toHaveBeenCalled();

    // Verify fail-open when Redis commands throw
    const failingStore = {
      get: jest.fn().mockRejectedValue(new Error('redis down')),
      getMany: jest.fn().mockRejectedValue(new Error('redis down')),
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      delete: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const failOpenCtx = nearbyContext({
      providers: [
        {
          id: 'p-db',
          distanceKm: 1.0,
          online: true,
          categoryId: 'cat-1',
          serviceId: 'srv-1',
        },
      ],
      cacheStore: failingStore,
    });
    const fallbackResponse = await failOpenCtx.service.nearby('user-id', {
      latitude: 10.7731,
      longitude: 106.703,
    });
    expect(fallbackResponse.data.map((p) => p.id)).toEqual(['p-db']);
  });

  it('attaches real reviewSummary from orderReview summaries in search and nearby', async () => {
    const provider = {
      id: 'provider-id',
      userId: 'user-provider',
      providerType: 'INDIVIDUAL',
      displayName: 'Minh Anh',
      avatarUrl: null,
      biography: 'Hair stylist',
      experienceYears: 5,
      serviceAreaName: 'Quận 1',
      serviceRadiusKm: 10,
      wallet: { balanceAmount: 100000, heldAmount: 0 },
      workingHours: fullHours,
      services: [
        {
          id: 'provider-service-id',
          priceAmount: 150_000,
          durationMinutes: 60,
          description: null,
          service: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Cắt tóc nữ',
            slug: 'cat-toc-nu',
            currencyCode: 'VND',
            targetAudience: ServiceTargetAudience.WOMEN,
            defaultDurationMinutes: 60,
            categoryId: 'cat-hair',
          },
        },
      ],
    };
    const prisma = {
      orderReview: {
        groupBy: jest.fn().mockResolvedValue([
          {
            providerId: 'provider-id',
            _count: { id: 6 },
            _avg: { rating: 4.5 },
          },
        ]),
      },
      customerAddress: {
        findFirst: jest.fn().mockResolvedValue({
          latitude: 10.7731,
          longitude: 106.703,
        }),
      },
      customerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      providerProfile: { findMany: jest.fn().mockResolvedValue([provider]) },
    };
    const locations = {
      findNearby: jest
        .fn()
        .mockResolvedValue([{ providerId: 'provider-id', distanceKm: 1.2 }]),
    };
    const service = new ProviderDiscoveryService(
      prisma as never,
      locations as never,
      { read: jest.fn().mockResolvedValue(new Map()) } as never,
      {
        find: jest.fn().mockResolvedValue([]),
        findAllInArea: jest.fn().mockResolvedValue([]),
      } as never,
      { canReceiveNewOrder: jest.fn().mockReturnValue(true) } as never,
      {
        search: jest.fn().mockResolvedValue({ data: [], searchLimited: false }),
      } as never,
    );

    const searchResult = await service.search('user-id', {
      serviceId: '00000000-0000-4000-8000-000000000001',
      customerAddressId: '00000000-0000-4000-8000-000000000002',
    });
    expect(searchResult.data[0].reviewSummary).toEqual({
      count: 6,
      averageRating: 4.5,
    });

    const nearbyResult = await service.nearby('user-id', {
      latitude: 10.7731,
      longitude: 106.703,
    });
    expect(nearbyResult.data[0].reviewSummary).toEqual({
      count: 6,
      averageRating: 4.5,
    });
  });

  it('resolves customer address origin only once during search', async () => {
    const { service, prisma } = context();
    await service.search('user-id', {
      serviceId: '00000000-0000-4000-8000-000000000001',
      customerAddressId: '00000000-0000-4000-8000-000000000002',
    });

    expect(prisma.customerAddress.findFirst).toHaveBeenCalledTimes(1);
  });

  it('computes acceptanceRate and onTimeRate from real orders or returns null instead of hardcoded constants', async () => {
    const ctxNoOrders = context();
    const emptyProfile =
      await ctxNoOrders.service.findPublicProfile('provider-id');
    expect(emptyProfile.data.stats.acceptanceRate).toBeNull();
    expect(emptyProfile.data.stats.onTimeRate).toBeNull();

    const baseStart = new Date('2026-10-18T10:00:00Z');
    const ctxWithOrders = context();
    (ctxWithOrders.prisma as Record<string, unknown>).serviceOrder = {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([
        {
          bookingType: 'SCHEDULED',
          acceptedAt: new Date('2026-10-18T08:00:00Z'),
          arrivedAt: new Date('2026-10-18T10:05:00Z'),
          expectedStartAt: baseStart,
        },
        {
          bookingType: 'SCHEDULED',
          acceptedAt: new Date('2026-10-18T08:05:00Z'),
          arrivedAt: new Date('2026-10-18T10:30:00Z'),
          expectedStartAt: baseStart,
        },
        {
          bookingType: 'ASAP',
          acceptedAt: null,
          arrivedAt: null,
          expectedStartAt: baseStart,
        },
      ]),
    };

    const profile =
      await ctxWithOrders.service.findPublicProfile('provider-id');
    expect(profile.data.stats).toMatchObject({
      completedOrdersCount: 2,
      acceptanceRate: 66.7,
      onTimeRate: 50,
    });
  });
});
