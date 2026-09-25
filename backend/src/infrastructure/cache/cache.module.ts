import { Module } from '@nestjs/common';
import { CACHE_STORE } from './cache-store';
import { RedisCacheService } from './redis-cache.service';

@Module({
  providers: [
    RedisCacheService,
    { provide: CACHE_STORE, useExisting: RedisCacheService },
  ],
  exports: [CACHE_STORE],
})
export class CacheModule {}
