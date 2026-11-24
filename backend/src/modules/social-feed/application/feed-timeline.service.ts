import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { FeedListQueryDto } from '../dto/feed.dto';

export const timelineMember = (post: { id: string; createdAt: Date }) =>
  `${String(post.createdAt.getTime()).padStart(16, '0')}:${post.id}`;

@Injectable()
export class FeedTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly config: ConfigService,
  ) {}

  async read<T extends { id: string; createdAt: Date }>(
    query: FeedListQueryDto,
    load: (ids?: string[]) => Promise<T[]>,
  ): Promise<T[]> {
    if (
      !this.config.get<boolean>('cache.feedIndexEnabled', false) ||
      this.cache.getStatus() !== 'up'
    )
      return load();
    let generation: bigint;
    try {
      const state = await this.prisma.feedCacheState.findUnique({
        where: { id: 'global' },
      });
      if (!state) return load();
      generation = state.version;
    } catch {
      return load();
    }
    const limit = (query.limit ?? 20) + 1;
    const scope = createHash('sha256')
      .update(
        JSON.stringify([
          query.providerId ?? null,
          query.serviceId ?? null,
          query.cursor ?? null,
          limit,
        ]),
      )
      .digest('hex');
    const key = `lambe:feed:v1:index:${generation}:${scope}`;
    const members = await this.bounded(
      this.cache.readSortedPage(key, limit),
      null,
    );
    if (
      members &&
      new Set(members).size === members.length &&
      members.every((member) => /^\d{16}:[a-f0-9-]{36}$/i.test(member))
    ) {
      const rows = members.length
        ? await load(members.map((member) => member.slice(17)))
        : [];
      // DB gates visibility, and a partial/evicted index never truncates a page silently.
      if (
        rows.length === members.length &&
        rows.every((post, i) => timelineMember(post) === members[i])
      )
        return rows;
    }
    const token = randomUUID();
    const locked = await this.bounded(
      this.cache.setIfAbsent(
        `${key}:lock`,
        token,
        this.config.get<number>('cache.feedLockTtlSeconds', 5),
      ),
      null,
    );
    try {
      const rows = await load();
      if (locked) {
        const current = await this.prisma.feedCacheState
          .findUnique({
            where: { id: 'global' },
          })
          .catch(() => null);
        if (current?.version === generation)
          await this.bounded(
            this.cache.replaceSortedPage(
              key,
              rows.map(timelineMember),
              this.config.get<number>('cache.feedIndexTtlSeconds', 300),
            ),
            false,
          );
      }
      return rows;
    } finally {
      if (locked)
        await this.bounded(
          this.cache.releaseLock(`${key}:lock`, token),
          undefined,
        );
    }
  }

  private async bounded<T>(promise: Promise<T>, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timer = setTimeout(
            () => resolve(fallback),
            this.config.get<number>('cache.feedTimeoutMs', 100),
          );
        }),
      ]);
    } catch {
      return fallback;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
