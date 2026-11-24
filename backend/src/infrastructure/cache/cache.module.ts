import { Module } from '@nestjs/common';
import { CACHE_STORE } from './cache-store';
import { RedisCacheService } from './redis-cache.service';
import { PROVIDER_LOCATION_STORE } from '../location/provider-location.store';
import { MEMBER_LOCATION_STORE } from '../location/member-location.store';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { ObservabilityMetricsModule } from '../observability/observability-metrics.module';

@Module({
  imports: [ObservabilityMetricsModule],
  providers: [
    RedisCacheService,
    ThrottlerStorageService,
    RedisThrottlerStorage,
    { provide: CACHE_STORE, useExisting: RedisCacheService },
    { provide: PROVIDER_LOCATION_STORE, useExisting: RedisCacheService },
    { provide: MEMBER_LOCATION_STORE, useExisting: RedisCacheService },
  ],
  exports: [
    CACHE_STORE,
    PROVIDER_LOCATION_STORE,
    MEMBER_LOCATION_STORE,
    RedisThrottlerStorage,
    RedisCacheService,
  ],
})
export class CacheModule {}
