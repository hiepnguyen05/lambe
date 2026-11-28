import { ServiceUnavailableException } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { runWithRequestId } from '../../common/http/request-context';

describe('RedisThrottlerStorage', () => {
  const record = {
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  };

  function context(status: 'up' | 'down' | 'disabled') {
    const redis = {
      getStatus: jest.fn().mockReturnValue(status),
      incrementRateLimit: jest.fn().mockResolvedValue(record),
    };
    const fallback = { increment: jest.fn().mockResolvedValue(record) };
    return {
      storage: new RedisThrottlerStorage(redis as never, fallback as never),
      redis,
      fallback,
    };
  }

  it('uses Redis for a shared production counter', async () => {
    const { storage, redis, fallback } = context('up');

    await expect(
      storage.increment('key', 60_000, 10, 60_000, 'medium'),
    ).resolves.toEqual(record);
    expect(redis.incrementRateLimit).toHaveBeenCalledWith(
      'key',
      60_000,
      10,
      60_000,
      'medium',
      undefined,
    );
    expect(fallback.increment).not.toHaveBeenCalled();
  });

  it('uses local storage only when Redis is explicitly disabled', async () => {
    const { storage, redis, fallback } = context('disabled');

    await expect(
      storage.increment('key', 1000, 3, 1000, 'short'),
    ).resolves.toEqual(record);
    expect(fallback.increment).toHaveBeenCalled();
    expect(redis.incrementRateLimit).not.toHaveBeenCalled();
  });

  it('fails closed when configured Redis is unavailable', async () => {
    const { storage, fallback } = context('down');

    await expect(
      storage.increment('key', 1000, 3, 1000, 'short'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fallback.increment).not.toHaveBeenCalled();
  });

  it('keeps public catalogue and Feed reads available with a conservative local limit', async () => {
    const { storage, fallback } = context('down');
    await runWithRequestId(
      'read',
      () => storage.increment('feed-key', 60000, 120, 60000, 'medium'),
      true,
    );
    expect(fallback.increment).toHaveBeenCalledWith(
      'feed-key',
      60000,
      30,
      60000,
      'medium',
    );
  });

  it('keeps the shared Redis connection deadline independent of a public read fallback', async () => {
    const { storage, redis, fallback } = context('up');
    await runWithRequestId(
      'feed-read',
      () => storage.increment('feed-key', 1000, 10, 1000, 'short'),
      true,
    );
    expect(redis.incrementRateLimit).toHaveBeenCalledWith(
      'feed-key',
      1000,
      10,
      1000,
      'short',
      undefined,
    );
    expect(fallback.increment).not.toHaveBeenCalled();
  });

  it('returns the conservative local limit after 100 ms without retiring Redis', async () => {
    jest.useFakeTimers();
    try {
      const { storage, redis, fallback } = context('up');
      redis.incrementRateLimit.mockReturnValue(new Promise(() => undefined));
      const request = runWithRequestId(
        'public-read',
        () => storage.increment('key', 1000, 10, 1000, 'short'),
        true,
      );
      await jest.advanceTimersByTimeAsync(100);
      await expect(request).resolves.toEqual(record);
      expect(fallback.increment).toHaveBeenCalledWith(
        'key',
        1000,
        5,
        1000,
        'short',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('handles a Redis disconnect after readiness without relaxing write protection', async () => {
    const { storage, redis, fallback } = context('up');
    redis.incrementRateLimit.mockRejectedValue(new Error('socket closed'));
    await runWithRequestId(
      'read',
      () => storage.increment('feed-key', 1000, 10, 1000, 'short'),
      true,
    );
    expect(fallback.increment).toHaveBeenCalledWith(
      'feed-key',
      1000,
      5,
      1000,
      'short',
    );
    await expect(
      runWithRequestId('write', () =>
        storage.increment('write-key', 1000, 10, 1000, 'short'),
      ),
    ).rejects.toThrow('socket closed');
  });
});
