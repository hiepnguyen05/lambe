import { ObservabilityMetrics } from './observability-metrics.service';
import { ObservabilityService } from './observability.service';

describe('ObservabilityService', () => {
  function createService() {
    const row = {
      pending: 2,
      retry: 1,
      failed: 1,
      pushRows: 3,
      failedRows: 1,
      oldestPush: new Date(Date.now() - 400_000),
      unpublished: 2,
      oldestNotice: new Date(Date.now() - 30_000),
    };
    const tx = {
      $executeRaw: jest
        .fn<Promise<number>, [{ sql: string }]>()
        .mockResolvedValue(0),
      $queryRaw: jest.fn((query: { sql: string; values: unknown[] }) =>
        Promise.resolve(query.sql.includes('set_config') ? [] : [row]),
      ),
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((work: (tx: unknown) => unknown) => work(tx)),
    };
    const cache = { getStatus: jest.fn().mockReturnValue('up') };
    const metrics = new ObservabilityMetrics();
    const service = new ObservabilityService(
      prisma as never,
      cache as never,
      metrics,
    );
    return { service, prisma, cache, metrics, tx, row };
  }

  afterEach(() => jest.useRealTimers());

  it('coalesces reads, caches for five seconds, and bounds read-only SQL', async () => {
    jest.useFakeTimers();
    const { service, prisma, tx, cache } = createService();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.snapshot()),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(cache.getStatus).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1_000,
      timeout: 2_000,
    });
    expect(tx.$executeRaw.mock.calls[0][0]).toMatchObject({
      sql: 'SET TRANSACTION READ ONLY',
    });
    const query = tx.$queryRaw.mock.calls[1][0];
    expect(query.sql).toContain('ORDER BY "availableAt" LIMIT');
    expect(query.sql).toContain('WHERE "publishedAt" IS NULL');
    expect(query.values).toEqual([10_001, 10_001, 10_001]);
    expect(query.sql).not.toMatch(/userId|deviceId|token|entityId/);
    expect(results[0].alerts).toContain('outbox_backlog_old');
    results[0].dependencies.redis.status = 'down';
    expect((await service.snapshot()).dependencies.redis.status).toBe('up');
    jest.advanceTimersByTime(4_999);
    await service.snapshot();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await service.snapshot();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('labels capped counts and raises bounded backlog growth alerts', async () => {
    jest.useFakeTimers();
    const { service, row } = createService();
    await service.snapshot();
    row.pending = 10_001;
    row.pushRows = 10_001;
    row.failedRows = 10_001;
    row.failed = 10_001;
    row.unpublished = 10_001;
    jest.advanceTimersByTime(5_000);
    const snapshot = await service.snapshot();
    expect(snapshot.dependencies.postgres).toMatchObject({
      status: 'up',
      push: {
        pending: 10_000,
        countsAreLowerBounds: true,
        failedIsLowerBound: true,
        oldestAgeIsLowerBound: true,
      },
      orderNotices: { unpublished: 10_000, countIsLowerBound: true },
    });
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining(['outbox_backlog_growing', 'outbox_backlog_high']),
    );
  });

  it('sanitizes dependency failures independently and caches failures too', async () => {
    const { service, prisma } = createService();
    prisma.$transaction.mockRejectedValue(
      new Error('postgres://admin:secret@private/token'),
    );
    const first = await service.snapshot();
    expect(first.dependencies).toMatchObject({
      postgres: { status: 'unavailable' },
      redis: { status: 'up' },
    });
    expect(JSON.stringify(first)).not.toMatch(/secret|private|postgres:\/\//);
    await service.snapshot();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const other = createService();
    other.cache.getStatus.mockImplementation(() => {
      throw new Error('redis://secret');
    });
    expect((await other.service.snapshot()).dependencies).toMatchObject({
      postgres: { status: 'up' },
      redis: { status: 'unavailable' },
    });
  });

  it('reports stale workers and sustained Firebase failure only after observation', async () => {
    jest.useFakeTimers();
    const { service, metrics } = createService();
    expect((await service.snapshot()).alerts).not.toContain(
      'worker_stale:push',
    );
    expect((await service.snapshot()).alerts).not.toContain(
      'firebase_failures_sustained',
    );
    metrics.recordWorkerRun('push', 'ok');
    metrics.recordFirebaseResult('error');
    jest.advanceTimersByTime(60_000);
    expect((await service.snapshot()).alerts).toEqual(
      expect.arrayContaining([
        'worker_stale:push',
        'firebase_failures_sustained',
      ]),
    );
    metrics.recordWorkerRun('push', 'ok');
    metrics.recordFirebaseResult('ok');
    expect((await service.snapshot()).alerts).not.toContain(
      'worker_stale:push',
    );
    expect((await service.snapshot()).alerts).not.toContain(
      'firebase_failures_sustained',
    );
  });
});
