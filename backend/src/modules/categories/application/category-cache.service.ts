import { Inject, Injectable } from '@nestjs/common';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import { CATEGORY_CACHE_KEYS } from './category-cache.constants';

@Injectable()
export class CategoryCacheService {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  getActive<T>(): Promise<T | null> {
    return this.cache.get<T>(CATEGORY_CACHE_KEYS.active);
  }

  setActive<T>(categories: T): Promise<void> {
    return this.cache.set(CATEGORY_CACHE_KEYS.active, categories);
  }

  invalidateActive(): Promise<void> {
    return this.cache.delete(CATEGORY_CACHE_KEYS.active);
  }
}
