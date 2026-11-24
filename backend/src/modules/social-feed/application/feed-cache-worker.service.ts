import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma, type FeedCacheEvent } from '@prisma/client';
import {
  CACHE_STORE,
  type CacheStore,
} from '../../../infrastructure/cache/cache-store';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class FeedCacheWorkerService {
  private readonly logger = new Logger(FeedCacheWorkerService.name);
  private processing = false;
  private nextRunAt = 0;
  readonly metrics = {
    runs: 0,
    processed: 0,
    retries: 0,
    lastRunAt: null as string | null,
    lastDurationMs: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly config: ConfigService,
  ) {}

  @Interval(1000)
  async tick(): Promise<void> {
    if (
      this.processing ||
      Date.now() < this.nextRunAt ||
      !this.config.get<boolean>('cache.feedEnabled', false) ||
      this.cache.getStatus() !== 'up'
    )
      return;
    this.nextRunAt =
      Date.now() + this.config.get<number>('cache.feedWorkerIntervalMs', 5000);
    this.processing = true;
    this.metrics.runs++;
    this.metrics.lastRunAt = new Date().toISOString();
    const started = performance.now();
    try {
      const batch = this.config.get<number>('cache.feedBatchSize', 50);
      for (let i = 0; i < batch && performance.now() - started < 2000; i++) {
        const [event] = await this.prisma.$queryRaw<
          FeedCacheEvent[]
        >(Prisma.sql`
          WITH due AS (SELECT sequence FROM feed_cache_events
            WHERE "processedAt" IS NULL AND "availableAt"<=NOW()
              AND ("lockedUntil" IS NULL OR "lockedUntil"<NOW())
            ORDER BY "availableAt",sequence FOR UPDATE SKIP LOCKED LIMIT 1)
          UPDATE feed_cache_events e SET "lockedUntil"=date_trunc('milliseconds',NOW())+INTERVAL '30 seconds', attempts=e.attempts+1
          FROM due WHERE e.sequence=due.sequence RETURNING e.*
        `);
        if (!event) break;
        await this.deliver(event);
      }
      // Only completed events are eligible for bounded housekeeping.
      await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM feed_cache_events WHERE sequence IN (
          SELECT sequence FROM feed_cache_events WHERE "processedAt"<NOW()-INTERVAL '7 days' ORDER BY sequence LIMIT 500)
      `);
    } catch {
      this.logger.error('feed.cache_worker.failed');
    } finally {
      this.metrics.lastDurationMs = performance.now() - started;
      this.processing = false;
    }
  }

  private async deliver(event: FeedCacheEvent) {
    const lease = {
      sequence: event.sequence,
      attempts: event.attempts,
      lockedUntil: event.lockedUntil,
      processedAt: null,
    };
    try {
      const deleted = await this.deadline(
        this.cache.deleteMany(event.oldCacheKey ? [event.oldCacheKey] : []),
      );
      const advanced = await this.deadline(
        this.cache.advanceGeneration(
          'lambe:feed:v1:generation',
          event.sequence.toString(),
          30 * 86400,
        ),
      );
      if (!deleted || !advanced) throw new Error('cache unavailable');
      await this.prisma.feedCacheEvent.updateMany({
        where: lease,
        data: { processedAt: new Date(), lockedUntil: null },
      });
      this.metrics.processed++;
    } catch {
      this.metrics.retries++;
      await this.prisma.feedCacheEvent.updateMany({
        where: lease,
        data: {
          lockedUntil: null,
          availableAt: new Date(
            Date.now() +
              Math.min(3600, 2 ** Math.min(event.attempts, 12)) * 1000,
          ),
        },
      });
      this.logger.warn('feed.cache_worker.retry');
    }
  }

  private async deadline<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('cache deadline')), 1000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async status() {
    const rows = await this.prisma.feedCacheEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
      take: 10001,
    });
    const pending = Math.min(rows.length, 10000);
    const oldest = rows[0];
    const oldestAgeSeconds = oldest
      ? Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1000)
      : 0;
    const alerts: string[] = [];
    if (pending >= 1000) alerts.push('feed_cache_backlog_high');
    if (oldestAgeSeconds >= 300) alerts.push('feed_cache_backlog_old');
    if (
      this.cache.getStatus() !== 'up' &&
      this.config.get<boolean>('cache.feedEnabled', false)
    )
      alerts.push('feed_cache_redis_unavailable');
    return {
      enabled: this.config.get<boolean>('cache.feedEnabled', false),
      indexEnabled: this.config.get<boolean>('cache.feedIndexEnabled', false),
      ...this.metrics,
      pending,
      pendingIsLowerBound: rows.length > 10000,
      oldestAgeSeconds,
      alerts,
    };
  }
}
