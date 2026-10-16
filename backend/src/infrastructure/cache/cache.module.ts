import { Module } from '@nestjs/common';
import { CACHE_STORE } from './cache-store';
import { RedisCacheService } from './redis-cache.service';
import { PROVIDER_LOCATION_STORE } from '../location/provider-location.store';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  providers: [
    RedisCacheService,
    ThrottlerStorageService,
    RedisThrottlerStorage,
    { provide: CACHE_STORE, useExisting: RedisCacheService },
    { provide: PROVIDER_LOCATION_STORE, useExisting: RedisCacheService },
  ],
  exports: [CACHE_STORE, PROVIDER_LOCATION_STORE, RedisThrottlerStorage],
})
export class CacheModule {}
