import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProviderProfileStatus } from '@prisma/client';
import { ProviderAvailabilityService } from './provider-availability.service';

function context() {
  const provider: {
    id: string;
    status: ProviderProfileStatus;
    setupCompletedAt: Date | null;
    serviceAreaLatitude: number | null;
    serviceAreaLongitude: number | null;
    serviceRadiusKm: number | null;
    wallet: { balanceAmount: number; heldAmount: number } | null;
    services: Array<{
      priceAmount: number;
      service: { minPriceAmount: number; maxPriceAmount: number };
    }>;
    _count: { services: number; workingHours: number };
  } = {
    id: 'provider-id',
    status: ProviderProfileStatus.ACTIVE,
    setupCompletedAt: new Date(),
    serviceAreaLatitude: 10.7731,
    serviceAreaLongitude: 106.703,
    serviceRadiusKm: 10,
    wallet: { balanceAmount: 100_000, heldAmount: 0 },
    services: [
      {
        priceAmount: 150_000,
        service: { minPriceAmount: 50_000, maxPriceAmount: 300_000 },
      },
    ],
    _count: { services: 1, workingHours: 1 },
  };
  const session = {
    id: 'session-id',
    startedAt: new Date(),
    lastHeartbeatAt: new Date(),
  };
  const availabilitySessions = {
    findFirst: jest.fn().mockResolvedValue(session),
    findMany: jest.fn().mockResolvedValue([session]),
    create: jest.fn().mockResolvedValue(session),
    update: jest.fn().mockResolvedValue(session),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: provider.id }]),
    providerProfile: { findUnique: jest.fn().mockResolvedValue(provider) },
    providerAvailabilitySession: availabilitySessions,
  };
  const prisma = {
    providerProfile: { findUnique: jest.fn().mockResolvedValue(provider) },
    providerAvailabilitySession: availabilitySessions,
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const locations = {
    getPosition: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
    isOnline: jest.fn().mockResolvedValue(true),
    findNearby: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(120) };
  config.get.mockImplementation((key: string, fallback: number) =>
    key === 'provider.minReceivingBalanceAmount' ? 50_000 : fallback,
  );
  return {
    service: new ProviderAvailabilityService(
      prisma as never,
      audit as never,
      config as never,
      locations,
    ),
    provider,
    locations,
    availabilitySessions,
    audit,
  };
}

describe('ProviderAvailabilityService', () => {
  afterEach(() => jest.useRealTimers());

  it('starts a traceable online session and stores location only in Redis', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    const { service, locations, availabilitySessions, audit } = context();
    await service.goOnline(
      'user-id',
      { latitude: 10.7731, longitude: 106.703 },
      {},
    );

    expect(locations.upsert).toHaveBeenCalledWith(
      'provider-id',
      10.7731,
      106.703,
    );
    expect(availabilitySessions.create).toHaveBeenCalledWith({
      data: {
        providerId: 'provider-id',
        lastHeartbeatAt: new Date('2026-09-28T12:00:00.000Z'),
      },
      select: { id: true, startedAt: true, lastHeartbeatAt: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVIDER_WENT_ONLINE' }),
      {},
      expect.anything(),
    );
  });

  it('requires completed provider setup before going online', async () => {
    const { service, provider, locations } = context();
    provider.setupCompletedAt = null;
    await expect(
      service.goOnline(
        'user-id',
        { latitude: 10.7731, longitude: 106.703 },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locations.upsert).not.toHaveBeenCalled();
  });

  it('does not allow a suspended provider to go online', async () => {
    const { service, provider } = context();
    provider.status = ProviderProfileStatus.SUSPENDED;
    await expect(
      service.goOnline(
        'user-id',
        { latitude: 10.7731, longitude: 106.703 },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires at least 50,000 VND of available wallet balance to go online', async () => {
    const { service, provider, locations } = context();
    provider.wallet = { balanceAmount: 60_000, heldAmount: 10_001 };

    try {
      await service.goOnline(
        'user-id',
        { latitude: 10.7731, longitude: 106.703 },
        {},
      );
      throw new Error('Expected goOnline to reject a low wallet balance.');
    } catch (error: unknown) {
      if (!(error instanceof ConflictException)) throw error;
      expect(error.getResponse()).toMatchObject({
        code: 'PROVIDER_WALLET_BALANCE_TOO_LOW',
      });
    }
    expect(locations.upsert).not.toHaveBeenCalled();
  });

  it('rechecks suspension after locking the provider row', async () => {
    const { service, provider, locations, availabilitySessions } = context();
    provider.status = ProviderProfileStatus.SUSPENDED;

    await expect(
      service.goOnline(
        'user-id',
        { latitude: 10.7731, longitude: 106.703 },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(locations.upsert).not.toHaveBeenCalled();
    expect(availabilitySessions.create).not.toHaveBeenCalled();
  });

  it('rejects a heartbeat without an active database session', async () => {
    const { service, availabilitySessions, locations } = context();
    availabilitySessions.findFirst.mockResolvedValue(null);
    await expect(
      service.heartbeat('user-id', {
        latitude: 10.7731,
        longitude: 106.703,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locations.upsert).not.toHaveBeenCalled();
  });

  it('does not restore Redis location when the session closes before heartbeat update', async () => {
    const { service, availabilitySessions, locations } = context();
    availabilitySessions.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.heartbeat('user-id', {
        latitude: 10.7731,
        longitude: 106.703,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locations.upsert).not.toHaveBeenCalled();
  });

  it('ends the online session when wallet balance drops below the minimum', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T08:00:00.000Z'));
    const { service, provider, availabilitySessions, locations } = context();
    provider.wallet = { balanceAmount: 49_999, heldAmount: 0 };

    await expect(
      service.heartbeat('user-id', {
        latitude: 10.7731,
        longitude: 106.703,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(availabilitySessions.updateMany).toHaveBeenCalledWith({
      where: { providerId: 'provider-id', endedAt: null },
      data: {
        endedAt: new Date('2026-10-15T08:00:00.000Z'),
        endReason: 'PROVIDER_WALLET_BALANCE_TOO_LOW',
      },
    });
    expect(locations.remove).toHaveBeenCalledWith('provider-id');
    expect(locations.upsert).not.toHaveBeenCalled();
  });
});
