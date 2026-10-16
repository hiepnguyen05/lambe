import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderEligibilityService } from './order-eligibility.service';

describe('booking eligibility', () => {
  const point = { latitude: 21.028, longitude: 105.834 };
  function context() {
    const provider = {
      id: 'provider',
      userId: 'provider-user',
      serviceRadiusKm: 5,
      serviceAreaLatitude: point.latitude,
      serviceAreaLongitude: point.longitude,
      wallet: { balanceAmount: 100000, heldAmount: 0 },
      workingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startMinute: 0,
        endMinute: 1440,
      })),
    };
    const prisma = {
      customerAddress: {
        findFirst: jest.fn().mockResolvedValue({ id: 'address', ...point }),
      },
      providerService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'service',
          providerId: provider.id,
          provider,
          priceAmount: 100000,
          durationMinutes: 60,
          service: { name: 'Haircut', currencyCode: 'VND' },
        }),
      },
    };
    const locations = { getPosition: jest.fn().mockResolvedValue(point) };
    const calendar = { read: jest.fn().mockResolvedValue(new Map()) };
    return {
      service: new OrderEligibilityService(
        prisma as never,
        locations as never,
        calendar as never,
        {
          get: jest
            .fn()
            .mockImplementation((key: string, fallback: number) =>
              key === 'provider.minReceivingBalanceAmount' ? 50_000 : fallback,
            ),
        } as never,
      ),
      provider,
      prisma,
      locations,
      calendar,
    };
  }
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T03:00:00Z')),
  );
  afterEach(() => jest.useRealTimers());
  const dto = {
    providerServiceId: 'service',
    customerAddressId: 'address',
    bookingType: 'SCHEDULED' as const,
    scheduledAt: '2026-10-12T14:00:00+07:00',
  };

  it('allows a future booking while the provider is offline', async () => {
    const { service, locations } = context();
    locations.getPosition.mockResolvedValue(null);
    expect((await service.prepare('customer', dto)).available).toBe(true);
    expect(locations.getPosition).not.toHaveBeenCalled();
  });
  it('checks the selected provider directly without truncating a nearby list', async () => {
    const { service, locations } = context();
    expect(
      (
        await service.prepare('customer', {
          ...dto,
          bookingType: 'ASAP',
          scheduledAt: undefined,
        })
      ).available,
    ).toBe(true);
    expect(locations.getPosition).toHaveBeenCalledWith('provider');
  });
  it('rejects ASAP when the location heartbeat is missing', async () => {
    const { service, locations } = context();
    locations.getPosition.mockResolvedValue(null);
    await expect(
      service.prepare('customer', {
        ...dto,
        bookingType: 'ASAP',
        scheduledAt: undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('requires a fresh GPS heartbeat before departure even for a scheduled order', async () => {
    const { service, locations } = context();
    locations.getPosition.mockResolvedValue(null);
    await expect(service.assertOnline('provider')).rejects.toBeInstanceOf(
      ConflictException,
    );
    locations.getPosition.mockResolvedValue(point);
    await expect(service.assertOnline('provider')).resolves.toBeUndefined();
  });
  it('enforces the provider radius even if search radius is larger', async () => {
    const { service, provider } = context();
    provider.serviceAreaLatitude += 0.1;
    await expect(service.prepare('customer', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('cannot use an address belonging to another account', async () => {
    const { service, prisma } = context();
    prisma.customerAddress.findFirst.mockResolvedValue(null);
    await expect(service.prepare('customer', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('does not offer appointments when funds are insufficient', async () => {
    const { service, provider } = context();
    provider.wallet.heldAmount = 100000;
    expect(await service.prepare('customer', dto)).toMatchObject({
      available: false,
      reason: 'PROVIDER_NOT_ACCEPTING_ORDERS',
      suggestedSlots: [],
    });
  });
  it('does not offer appointments when available balance is below the 50,000 VND floor', async () => {
    const { service, provider } = context();
    provider.wallet.balanceAmount = 49_999;
    expect(await service.prepare('customer', dto)).toMatchObject({
      available: false,
      reason: 'PROVIDER_NOT_ACCEPTING_ORDERS',
      suggestedSlots: [],
    });
  });
  it('suggests a later slot for a conflicting request without revealing another customer', async () => {
    const { service, calendar } = context();
    calendar.read.mockResolvedValue(
      new Map([
        [
          'provider',
          [
            {
              startAt: new Date(dto.scheduledAt),
              endAt: new Date('2026-10-12T15:00:00+07:00'),
              point,
            },
          ],
        ],
      ]),
    );
    const response = await service.prepare('customer', dto);
    expect(response.available).toBe(false);
    expect(response.suggestedSlots[0].startAt).toEqual(
      new Date('2026-10-12T15:30:00+07:00'),
    );
  });
});
