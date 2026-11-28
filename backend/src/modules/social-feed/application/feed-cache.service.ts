import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { raceWithTimeout } from '../../../common/async/race-with-timeout';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';

export interface FeedCacheIdentity {
  id: string;
  revisionNumber: number;
  updatedAt: Date;
}

export interface CachedPublicFeedPost {
  id: string;
  revisionNumber: number;
  caption: string;
  authorMember: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  media: {
    id: string;
    kind: string;
    url: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    position: number;
  }[];
}

@Injectable()
export class FeedCacheService {
  readonly metrics = {
    list: { hits: 0, misses: 0 },
    detail: { hits: 0, misses: 0 },
    writeAttempts: 0,
    timeouts: 0,
    errors: 0,
    bytesAttempted: 0,
    operationMs: 0,
    writeMs: 0,
  };
  private readonly loads = new Map<string, Promise<unknown>>();
  constructor(
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return (
      this.config.get<boolean>('cache.feedEnabled', false) &&
      this.cache.getStatus() === 'up'
    );
  }

  private key(post: FeedCacheIdentity) {
    return `lambe:feed:v1:post:${post.id}:revision:${post.revisionNumber}:updated:${post.updatedAt.getTime()}`;
  }

  async getMany(
    posts: FeedCacheIdentity[],
    source: 'list' | 'detail' = 'list',
  ): Promise<(CachedPublicFeedPost | null)[]> {
    if (!this.isEnabled() || !posts.length) return posts.map(() => null);
    const values = await this.bounded(
      this.cache.getMany<unknown>(posts.map((post) => this.key(post))),
      posts.map(() => null),
    );
    return posts.map((post, index) => {
      const value = this.decode(values[index], post);
      this.metrics[source][value ? 'hits' : 'misses']++;
      return value;
    });
  }

  async set(
    post: FeedCacheIdentity,
    content: CachedPublicFeedPost,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    // Whitelist public fields; never persist managed metadata, viewer flags or counts.
    const safe = this.decode(content, post);
    if (!safe) return;
    const ttl = this.config.get<number>('cache.feedPostTtlSeconds', 120);
    const at = performance.now();
    await this.bounded(
      this.cache.set(
        this.key(post),
        safe,
        Math.min(
          240,
          Math.max(1, Math.floor(ttl * (0.9 + Math.random() * 0.2))),
        ),
      ),
      undefined,
    );
    this.metrics.writeAttempts++;
    this.metrics.bytesAttempted += Buffer.byteLength(JSON.stringify(safe));
    this.metrics.writeMs += performance.now() - at;
  }

  async coalesce<T>(
    posts: FeedCacheIdentity[],
    load: () => Promise<T>,
  ): Promise<T> {
    const key = posts
      .map((post) => this.key(post))
      .sort()
      .join('|');
    const active = this.loads.get(key);
    if (active) return active as Promise<T>;
    const promise = load();
    // A fixed bound keeps a stream of cold IDs from growing this registry indefinitely.
    if (this.loads.size >= 256) return promise;
    this.loads.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.loads.get(key) === promise) this.loads.delete(key);
    }
  }

  private decode(
    value: unknown,
    post: FeedCacheIdentity,
  ): CachedPublicFeedPost | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as CachedPublicFeedPost;
    if (
      item.id !== post.id ||
      item.revisionNumber !== post.revisionNumber ||
      typeof item.caption !== 'string' ||
      !Array.isArray(item.media) ||
      item.media.length < 1 ||
      item.media.length > 6
    )
      return null;
    if (
      item.authorMember !== null &&
      (!item.authorMember ||
        typeof item.authorMember.id !== 'string' ||
        !this.nullableString(item.authorMember.displayName) ||
        !this.nullableString(item.authorMember.avatarUrl))
    )
      return null;
    const media: CachedPublicFeedPost['media'] = [];
    for (const asset of item.media) {
      if (
        !asset ||
        typeof asset.id !== 'string' ||
        !['IMAGE', 'VIDEO'].includes(asset.kind) ||
        typeof asset.url !== 'string' ||
        !this.nullableNumber(asset.width) ||
        !this.nullableNumber(asset.height) ||
        !this.nullableNumber(asset.durationSeconds) ||
        !Number.isInteger(asset.position)
      )
        return null;
      try {
        const url = new URL(asset.url);
        if (url.protocol !== 'https:' || url.username || url.password)
          return null;
      } catch {
        return null;
      }
      media.push({
        id: asset.id,
        kind: asset.kind,
        url: asset.url,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        position: asset.position,
      });
    }
    return {
      id: item.id,
      revisionNumber: item.revisionNumber,
      caption: item.caption,
      authorMember:
        item.authorMember === null
          ? null
          : {
              id: item.authorMember.id,
              displayName: item.authorMember.displayName,
              avatarUrl: item.authorMember.avatarUrl,
            },
      media,
    };
  }

  private nullableString(value: unknown) {
    return value === null || typeof value === 'string';
  }
  private nullableNumber(value: unknown) {
    return (
      value === null ||
      (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    );
  }

  private async bounded<T>(operation: Promise<T>, fallback: T): Promise<T> {
    const at = performance.now();
    try {
      return await raceWithTimeout(
        operation,
        this.config.get<number>('cache.feedTimeoutMs', 100),
        () => {
          this.metrics.timeouts++;
          return fallback;
        },
      );
    } catch {
      this.metrics.errors++;
      return fallback;
    } finally {
      this.metrics.operationMs += performance.now() - at;
    }
  }
}
