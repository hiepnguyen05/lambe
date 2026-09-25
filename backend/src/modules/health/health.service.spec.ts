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
    };
  };

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
});
