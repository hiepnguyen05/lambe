import { Inject, Injectable } from '@nestjs/common';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import { MARKETPLACE_CACHE_KEYS } from '../../../common/cache/marketplace-cache.constants';

@Injectable()
export class ServiceCacheService {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  getActive<T>(): Promise<T | null> {
    return this.cache.get<T>(MARKETPLACE_CACHE_KEYS.activeServices);
  }

  setActive<T>(services: T): Promise<void> {
    return this.cache.set(MARKETPLACE_CACHE_KEYS.activeServices, services);
  }

  invalidateActive(): Promise<void> {
    return this.cache.delete(MARKETPLACE_CACHE_KEYS.activeServices);
  }
}
