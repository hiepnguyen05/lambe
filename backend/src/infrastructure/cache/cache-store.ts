export const CACHE_STORE = Symbol('CACHE_STORE');

export type CacheStatus = 'up' | 'down' | 'disabled';

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  setMany<T>(
    entries: { key: string; value: T }[],
    ttlSeconds: number,
  ): Promise<boolean>;
  deleteMany(keys: string[]): Promise<boolean>;
  setIfAbsent(
    key: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean | null>;
  releaseLock(key: string, token: string): Promise<void>;
  replaceSortedPage(
    key: string,
    members: string[],
    ttlSeconds: number,
  ): Promise<boolean>;
  readSortedPage(key: string, limit: number): Promise<string[] | null>;
  advanceGeneration(
    key: string,
    sequence: string,
    ttlSeconds: number,
  ): Promise<boolean>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getStatus(): CacheStatus;
}
