export const CACHE_STORE = Symbol('CACHE_STORE');

export type CacheStatus = 'up' | 'down' | 'disabled';

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  deleteMany(keys: string[]): Promise<boolean>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getStatus(): CacheStatus;
}
