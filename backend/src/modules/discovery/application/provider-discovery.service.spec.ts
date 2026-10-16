import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProviderDiscoveryService } from './provider-discovery.service';

function context() {
  const provider = {
    id: 'provider-id',
    providerType: 'INDIVIDUAL',
    displayName: 'Minh Anh',
    avatarUrl: null,
    biography: 'Hair stylist',
    experienceYears: 5,
    serviceAreaName: 'Quận 1',
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
    });
    expect(response.data[0]).not.toHaveProperty('serviceAreaLatitude');
    expect(response.data[0]).not.toHaveProperty('serviceAreaLongitude');
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
});
