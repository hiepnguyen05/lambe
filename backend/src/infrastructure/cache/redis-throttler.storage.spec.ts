import { ServiceUnavailableException } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

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
});
