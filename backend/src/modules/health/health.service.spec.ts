import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const createService = (cacheStatus: 'up' | 'down' | 'disabled' = 'up') => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const cache = { getStatus: jest.fn().mockReturnValue(cacheStatus) };

    return {
      service: new HealthService(prisma as never, cache as never),
      prisma,
      cache,
    };
  };
  afterEach(() => jest.useRealTimers());

  it.each([
    ['up', 'ok'],
    ['disabled', 'ok'],
    ['down', 'degraded'],
  ] as const)('reports cache %s as %s', async (cacheStatus, status) => {
    const { service } = createService(cacheStatus);

    await expect(service.check()).resolves.toMatchObject({
      status,
      services: { database: 'up', cache: cacheStatus },
    });
  });

  it('returns unavailable when PostgreSQL cannot be queried', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw.mockRejectedValue(new Error('database offline'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('coalesces parallel database probes, caches for one second, and reads Redis status fresh', async () => {
    jest.useFakeTimers();
    const { service, prisma, cache } = createService();
    let finish!: (value: unknown[]) => void;
    prisma.$queryRaw.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const readers = Array.from({ length: 30 }, () => service.check());
    await Promise.resolve();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    finish([]);
    await Promise.all(readers);
    cache.getStatus.mockReturnValue('down');
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      services: { cache: 'down' },
    });
    jest.advanceTimersByTime(999);
    await service.check();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    prisma.$queryRaw.mockResolvedValue([]);
    jest.advanceTimersByTime(1);
    await service.check();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('bounds response wait without replacing a hung ping, then recovers when it settles', async () => {
    jest.useFakeTimers();
    const { service, prisma } = createService();
    let finish!: (value: unknown[]) => void;
    prisma.$queryRaw.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(1_000);
    await first;
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    jest.advanceTimersByTime(10_000);
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    finish([]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await expect(service.check()).resolves.toMatchObject({
      services: { database: 'up' },
    });
  });

  it('caches database failures briefly and keeps failure responses sanitized', async () => {
    const { service, prisma, cache } = createService();
    prisma.$queryRaw.mockRejectedValue(new Error('postgres://secret@private'));
    await expect(service.check()).rejects.toMatchObject({
      response: { status: 'unavailable' },
    });
    cache.getStatus.mockReturnValue('down');
    await expect(service.check()).rejects.toMatchObject({
      response: {
        success: false,
        status: 'unavailable',
        services: { database: 'down', cache: 'down' },
      },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
