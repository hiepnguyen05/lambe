import { ServiceUnavailableException } from '@nestjs/common';
import { TimeoutError } from 'redis';
import { ObservabilityMetrics } from '../observability/observability-metrics.service';
import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  const createDisabledService = (metrics?: ObservabilityMetrics) => {
    const configService = {
      get: jest.fn((key: string, defaultValue: unknown) =>
        key === 'cache.enabled' ? false : defaultValue,
      ),
    };

    return new RedisCacheService(configService as never, metrics);
  };

  it('acts as a no-op cache when Redis is disabled', async () => {
    const service = createDisabledService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.get('missing')).resolves.toBeNull();
    await expect(service.getMany(['one', 'two'])).resolves.toEqual([
      null,
      null,
    ]);
    await expect(service.set('key', { value: true })).resolves.toBeUndefined();
    await expect(service.delete('key')).resolves.toBeUndefined();
    await expect(service.setMany([{ key: 'key', value: 1 }], 30)).resolves.toBe(
      false,
    );
    await expect(service.deleteMany(['key'])).resolves.toBe(false);
    await expect(service.readSortedPage('index', 21)).resolves.toBeNull();
    await expect(service.replaceSortedPage('index', [], 30)).resolves.toBe(
      false,
    );
    await expect(service.setIfAbsent('lock', 'token', 5)).resolves.toBeNull();
    await expect(service.releaseLock('lock', 'token')).resolves.toBeUndefined();
    await expect(
      service.advanceGeneration('generation', '1', 30),
    ).resolves.toBe(false);
    await expect(service.publishChatUpdate('chat-id')).resolves.toBeUndefined();
    expect(service.getStatus()).toBe('disabled');
    await expect(service.isOnline('provider')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      service.findNearby(10.7, 106.7, 10, 20),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('keeps batch positions and treats corrupt JSON as a single cache miss', async () => {
    const metrics = new ObservabilityMetrics();
    const service = createDisabledService(metrics);
    const mGet = jest.fn().mockResolvedValue(['{"id":1}', 'bad json', null]);
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      mGet,
      withCommandOptions: jest.fn().mockReturnValue({ mGet }),
    };
    await expect(service.getMany(['one', 'two', 'three'])).resolves.toEqual([
      { id: 1 },
      null,
      null,
    ]);
    mGet.mockRejectedValue(new Error('offline'));
    await expect(service.getMany(['one'])).resolves.toEqual([null]);
    await expect(service.getMany([])).resolves.toEqual([]);
    expect(metrics.snapshot().redis.commands.batchRead).toMatchObject({
      duration: { count: 2 },
      errors: 1,
    });
    expect(metrics.snapshot().redis.cacheLookups.other).toEqual({
      hits: 1,
      misses: 2,
      errors: 1,
    });
  });

  it('counts cache outcomes by fixed domain without retaining keys or values', async () => {
    const metrics = new ObservabilityMetrics();
    const service = createDisabledService(metrics);
    const get = jest
      .fn()
      .mockResolvedValueOnce('{"name":"secret-marker"}')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('invalid-json')
      .mockResolvedValueOnce('null');
    const mGet = jest.fn().mockResolvedValue(['{"id":1}', null]);
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      withCommandOptions: jest.fn().mockReturnValue({ get, mGet }),
    };
    await service.get('service-categories:active:v1');
    await service.get('services:active:v2');
    await service.get('services:active:v2');
    await service.get('random:secret-key');
    await service.getMany([
      'lambe:feed:v1:post:private-id:revision:1',
      'random:other-secret',
    ]);
    expect(metrics.snapshot().redis.cacheLookups).toEqual({
      categories: { hits: 1, misses: 0, errors: 0 },
      services: { hits: 0, misses: 2, errors: 0 },
      feedPosts: { hits: 1, misses: 0, errors: 0 },
      other: { hits: 0, misses: 2, errors: 0 },
    });
    expect(JSON.stringify(metrics.snapshot())).not.toMatch(
      /private-id|secret-marker|other-secret/,
    );
  });

  it('bounds a stalled cache read and records a timeout without leaking Redis errors', async () => {
    const metrics = new ObservabilityMetrics();
    const service = createDisabledService(metrics);
    const get = jest.fn().mockRejectedValue(new TimeoutError());
    const withCommandOptions = jest.fn().mockReturnValue({ get });
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      withCommandOptions,
    };
    const logger = (
      service as unknown as { logger: { warn: (message: string) => void } }
    ).logger;
    const warning = jest.spyOn(logger, 'warn').mockImplementation();

    await expect(service.get('private-key')).resolves.toBeNull();
    await expect(service.get('private-key')).resolves.toBeNull();
    expect(withCommandOptions).toHaveBeenCalledWith({ timeout: 1000 });
    expect(metrics.snapshot().redis.commands.read).toMatchObject({
      duration: { count: 2 },
      errors: 2,
      timeouts: 2,
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(metrics.snapshot())).not.toContain('private-key');
  });

  it('fails closed when the Redis rate-limit command times out', async () => {
    const metrics = new ObservabilityMetrics();
    const service = createDisabledService(metrics);
    const evalCommand = jest.fn().mockRejectedValue(new TimeoutError());
    const withCommandOptions = jest.fn().mockReturnValue({ eval: evalCommand });
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      withCommandOptions,
    };

    await expect(
      service.incrementRateLimit('private-key', 1000, 5, 1000, 'short'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(withCommandOptions).toHaveBeenCalledWith({ timeout: 1000 });
    expect(metrics.snapshot().redis.commands.rateLimit).toMatchObject({
      duration: { count: 1 },
      errors: 1,
      timeouts: 1,
    });
    expect(JSON.stringify(metrics.snapshot())).not.toContain('private-key');
  });

  it('applies the smaller Feed deadline to the Redis command itself', async () => {
    const service = createDisabledService();
    const evalCommand = jest.fn().mockResolvedValue([1, 1000, 0, 0]);
    const withCommandOptions = jest.fn().mockReturnValue({ eval: evalCommand });
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      withCommandOptions,
    };
    await service.incrementRateLimit('feed-key', 1000, 10, 1000, 'short', 100);
    expect(withCommandOptions).toHaveBeenCalledWith({ timeout: 100 });
  });

  it('returns 503 without leaking transport details when rate limiting disconnects', async () => {
    const service = createDisabledService();
    const evalCommand = jest
      .fn()
      .mockRejectedValue(new Error('private Redis transport detail'));
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      withCommandOptions: jest.fn().mockReturnValue({ eval: evalCommand }),
    };
    await expect(
      service.incrementRateLimit('private-key', 1000, 5, 1000, 'short'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('waits for a previous unsubscribe before reconnecting the same order', async () => {
    const service = createDisabledService();
    let finishUnsubscribe!: () => void;
    const unsubscribePending = new Promise<void>((resolve) => {
      finishUnsubscribe = resolve;
    });
    const subscriber = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest
        .fn()
        .mockReturnValueOnce(unsubscribePending)
        .mockResolvedValue(undefined),
      isReady: true,
      isOpen: true,
    };
    const client = {
      isReady: true,
      duplicate: jest.fn().mockReturnValue(subscriber),
    };
    (service as unknown as { client: unknown }).client = client;

    const stopFirst = await service.subscribeTracking('order-1', jest.fn());
    const stopping = stopFirst();
    expect(subscriber.unsubscribe).toHaveBeenCalledTimes(1);
    const reconnecting = service.subscribeTracking('order-1', jest.fn());
    await Promise.resolve();
    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);

    finishUnsubscribe();
    await stopping;
    const stopSecond = await reconnecting;
    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);
    await stopSecond();
    expect(subscriber.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('turns Redis member location failures into a safe unavailable response', async () => {
    const service = createDisabledService();
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      eval: jest
        .fn()
        .mockRejectedValue(new Error('private connection details')),
    };
    await expect(
      service.getMemberPosition('member', 'session'),
    ).rejects.toThrow('Dịch vụ vị trí thành viên tạm thời không khả dụng.');
    await expect(
      service.removeMemberPosition('member', 1),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('delivers published updates to a joining listener when the old listener leaves during readiness', async () => {
    const service = createDisabledService();
    const publications = new Map<string, () => void>();
    const subscriber = {
      isReady: true,
      isOpen: true,
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      subscribe: jest.fn((channel: string, receive: () => void) => {
        publications.set(channel, receive);
        return Promise.resolve();
      }),
      unsubscribe: jest.fn((channel: string) => {
        publications.delete(channel);
        return Promise.resolve();
      }),
    };
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      duplicate: () => subscriber,
    };
    const oldListener = jest.fn();
    const newListener = jest.fn();
    const stopOld = await service.subscribeTracking('order-join', oldListener);
    const channel = 'lambe:orders:tracking:events:order-join';
    const entry = (
      service as unknown as {
        trackingListeners: Map<string, { ready: Promise<void> }>;
      }
    ).trackingListeners.get(channel)!;
    const ready = entry.ready;
    let reachedReadiness!: () => void;
    const joiningAtReadiness = new Promise<void>((resolve) => {
      reachedReadiness = resolve;
    });
    // Signal the exact await boundary without changing readiness or counting ticks.
    Object.defineProperty(entry, 'ready', {
      get: () => {
        reachedReadiness();
        return ready;
      },
    });
    const joining = service.subscribeTracking('order-join', newListener);
    await joiningAtReadiness;
    await stopOld();
    const stopNew = await joining;
    publications.get(channel)?.();
    expect(newListener).toHaveBeenCalledTimes(1);
    expect(oldListener).not.toHaveBeenCalled();
    expect(subscriber.unsubscribe).not.toHaveBeenCalled();
    await stopNew();
    expect(subscriber.unsubscribe).toHaveBeenCalledTimes(1);
    expect(publications.has(channel)).toBe(false);
  });

  it('releases failed joining listeners so a later subscription can receive updates', async () => {
    const service = createDisabledService();
    let rejectSubscription!: (error: Error) => void;
    const failedReadiness = new Promise<void>((_resolve, reject) => {
      rejectSubscription = reject;
    });
    let receive: (() => void) | undefined;
    let attempts = 0;
    const subscriber = {
      isReady: true,
      isOpen: true,
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      subscribe: jest.fn((...args: [string, () => void]) => {
        receive = args[1];
        return ++attempts === 1 ? failedReadiness : Promise.resolve();
      }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };
    (service as unknown as { client: unknown }).client = {
      isReady: true,
      duplicate: () => subscriber,
    };
    const failedListener = jest.fn();
    const secondFailedListener = jest.fn();
    const failedJoins = Promise.allSettled([
      service.subscribeTracking('order-failed', secondFailedListener),
      service.subscribeTracking('order-failed', failedListener),
    ]);
    // Both joins reach the pending transport acknowledgement before it fails.
    await new Promise<void>((resolve) => setImmediate(resolve));
    rejectSubscription(new Error('Subscription unavailable'));
    expect((await failedJoins).map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    const recoveredListener = jest.fn();
    const stop = await service.subscribeTracking(
      'order-failed',
      recoveredListener,
    );
    receive?.();
    expect(recoveredListener).toHaveBeenCalledTimes(1);
    expect(failedListener).not.toHaveBeenCalled();
    expect(secondFailedListener).not.toHaveBeenCalled();
    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);
    await stop();
  });
});
