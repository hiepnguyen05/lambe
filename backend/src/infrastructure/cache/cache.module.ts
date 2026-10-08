import { Module } from '@nestjs/common';
import { CACHE_STORE } from './cache-store';
import { RedisCacheService } from './redis-cache.service';
import { PROVIDER_LOCATION_STORE } from '../location/provider-location.store';

@Module({
  providers: [
    RedisCacheService,
    { provide: CACHE_STORE, useExisting: RedisCacheService },
    { provide: PROVIDER_LOCATION_STORE, useExisting: RedisCacheService },
  ],
  exports: [CACHE_STORE, PROVIDER_LOCATION_STORE],
})
export class CacheModule {}
