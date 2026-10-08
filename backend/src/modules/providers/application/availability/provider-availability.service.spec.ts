import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    _count: { services: number };
  } = {
    id: 'provider-id',
    status: ProviderProfileStatus.ACTIVE,
    setupCompletedAt: new Date(),
    serviceAreaLatitude: 10.7731,
    serviceAreaLongitude: 106.703,
    serviceRadiusKm: 10,
    _count: { services: 1 },
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
    upsert: jest.fn(),
    remove: jest.fn(),
    isOnline: jest.fn().mockResolvedValue(true),
    findNearby: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(120) };
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
});
