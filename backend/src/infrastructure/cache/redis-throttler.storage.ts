import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { RedisCacheService, type RateLimitRecord } from './redis-cache.service';
import { allowsPublicReadFallback } from '../../common/http/request-context';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: RedisCacheService,
    private readonly fallback: ThrottlerStorageService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RateLimitRecord> {
    const status = this.redis.getStatus();
    if (status === 'disabled') {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
    if (status !== 'up') {
      if (allowsPublicReadFallback())
        return this.fallback.increment(
          key,
          ttl,
          Math.min(limit, throttlerName === 'short' ? 5 : 30),
          blockDuration,
          throttlerName,
        );
      throw new ServiceUnavailableException(
        'Dịch vụ bảo vệ giới hạn truy cập đang tạm thời không khả dụng.',
      );
    }
    const publicRead = allowsPublicReadFallback();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Keep the shared socket's recovery deadline independent of the 100 ms
      // public-read fallback. A slow read must not disconnect other routes.
      const operation = this.redis.incrementRateLimit(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
        undefined,
      );
      return publicRead
        ? await Promise.race([
            operation,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new ServiceUnavailableException()),
                100,
              );
            }),
          ])
        : await operation;
    } catch (error) {
      if (publicRead)
        return this.fallback.increment(
          key,
          ttl,
          Math.min(limit, throttlerName === 'short' ? 5 : 30),
          blockDuration,
          throttlerName,
        );
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
