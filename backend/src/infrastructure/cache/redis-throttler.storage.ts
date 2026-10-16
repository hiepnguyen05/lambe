import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { RedisCacheService, type RateLimitRecord } from './redis-cache.service';

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
      throw new ServiceUnavailableException(
        'Dịch vụ bảo vệ giới hạn truy cập đang tạm thời không khả dụng.',
      );
    }
    return this.redis.incrementRateLimit(
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName,
    );
  }
}
