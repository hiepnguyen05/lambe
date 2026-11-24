import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CACHE_STORE, type CacheStore } from '../cache/cache-store';
import { PrismaService } from '../persistence/postgres/prisma.service';
import {
  OBSERVABILITY_LIMITS as LIMITS,
  ObservabilityMetrics,
} from './observability-metrics.service';

type QueueRow = {
  pending: number;
  retry: number;
  failed: number;
  pushRows: number;
  failedRows: number;
  oldestPush: Date | null;
  unpublished: number;
  oldestNotice: Date | null;
};

@Injectable()
export class ObservabilityService {
  private cached?: {
    expiresAt: number;
    value: Awaited<ReturnType<ObservabilityService['readDependencies']>>;
  };
  private reading?: Promise<
    Awaited<ReturnType<ObservabilityService['readDependencies']>>
  >;
  private previousBacklog?: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_STORE) private readonly cache: CacheStore,
    private readonly metrics: ObservabilityMetrics,
  ) {}

  private async readPostgres() {
    try {
      const row = await this.prisma.$transaction(
        async (tx) => {
          // Read-only transaction, local statement deadline, and bounded result sets.
          await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
          await tx.$queryRaw(
            Prisma.sql`SELECT set_config('statement_timeout', ${`${LIMITS.queryTimeoutMs}ms`}, true)`,
          );
          const [result] = await tx.$queryRaw<QueueRow[]>(Prisma.sql`
          WITH pending AS MATERIALIZED (
            SELECT "attempts", "createdAt" FROM "push_outbox"
            WHERE "sentAt" IS NULL AND "failedAt" IS NULL
            ORDER BY "availableAt" LIMIT ${LIMITS.queueRows + 1}
          ), failed AS MATERIALIZED (
            SELECT 1 FROM "push_outbox" WHERE "failedAt" IS NOT NULL
            ORDER BY "availableAt" LIMIT ${LIMITS.queueRows + 1}
          ), notices AS MATERIALIZED (
            SELECT "createdAt" FROM "order_notifications" WHERE "publishedAt" IS NULL
            ORDER BY "createdAt" LIMIT ${LIMITS.queueRows + 1}
          )
          SELECT
            (SELECT COUNT(*)::int FROM pending WHERE "attempts" = 0) AS "pending",
            (SELECT COUNT(*)::int FROM pending WHERE "attempts" > 0) AS "retry",
            (SELECT COUNT(*)::int FROM pending) AS "pushRows",
            (SELECT COUNT(*)::int FROM failed) AS "failed",
            (SELECT COUNT(*)::int FROM failed) AS "failedRows",
            (SELECT MIN("createdAt") FROM pending) AS "oldestPush",
            (SELECT COUNT(*)::int FROM notices) AS "unpublished",
            (SELECT MIN("createdAt") FROM notices) AS "oldestNotice"
        `);
          if (!result) throw new Error('Missing aggregates');
          return result;
        },
        { maxWait: 1_000, timeout: 2_000 },
      );
      const age = (date: Date | null) =>
        date === null
          ? null
          : Math.max(0, Math.floor((Date.now() - date.getTime()) / 1_000));
      const backlog =
        Math.min(row.pushRows, LIMITS.queueRows) +
        Math.min(row.unpublished, LIMITS.queueRows);
      const growing =
        this.previousBacklog !== undefined && backlog > this.previousBacklog;
      this.previousBacklog = backlog;
      return {
        status: 'up' as const,
        rowLimit: LIMITS.queueRows,
        push: {
          // Pending = never attempted; retry = attempted but neither sent nor terminal.
          // Includes leased and delayed work, not just rows currently due.
          pending: Math.min(row.pending, LIMITS.queueRows),
          retry: Math.min(row.retry, LIMITS.queueRows),
          failed: Math.min(row.failed, LIMITS.queueRows),
          backlog: Math.min(row.pushRows, LIMITS.queueRows),
          countsAreLowerBounds: row.pushRows > LIMITS.queueRows,
          failedIsLowerBound: row.failedRows > LIMITS.queueRows,
          oldestAgeSeconds: age(row.oldestPush),
          oldestAgeIsLowerBound: row.pushRows > LIMITS.queueRows,
        },
        orderNotices: {
          unpublished: Math.min(row.unpublished, LIMITS.queueRows),
          countIsLowerBound: row.unpublished > LIMITS.queueRows,
          oldestAgeSeconds: age(row.oldestNotice),
        },
        backlogGrowing: growing,
      };
    } catch {
      return { status: 'unavailable' as const };
    }
  }

  private async readDependencies() {
    const [postgres, redis] = await Promise.all([
      this.readPostgres(),
      Promise.resolve().then(() => {
        try {
          const status = this.cache.getStatus();
          return {
            status: ['up', 'down', 'disabled'].includes(status)
              ? status
              : 'unavailable',
          };
        } catch {
          return { status: 'unavailable' };
        }
      }),
    ]);
    return { sampledAt: new Date().toISOString(), postgres, redis };
  }

  private dependencies() {
    if (this.cached && this.cached.expiresAt > Date.now())
      return Promise.resolve(this.cached.value);
    if (!this.reading) {
      this.reading = this.readDependencies()
        .then((value) => {
          this.cached = { expiresAt: Date.now() + LIMITS.cacheMs, value };
          return value;
        })
        .finally(() => {
          this.reading = undefined;
        });
    }
    return this.reading;
  }

  async snapshot() {
    const dependencies = await this.dependencies();
    const local = this.metrics.snapshot();
    const alerts: string[] = [];
    const db = dependencies.postgres;
    if (db.status !== 'up') alerts.push('postgres_unavailable');
    else {
      if (
        db.push.backlog >= LIMITS.backlogCount ||
        db.orderNotices.unpublished >= LIMITS.backlogCount
      )
        alerts.push('outbox_backlog_high');
      if (
        (db.push.oldestAgeSeconds ?? 0) >= LIMITS.backlogAgeSeconds ||
        (db.orderNotices.oldestAgeSeconds ?? 0) >= LIMITS.backlogAgeSeconds
      )
        alerts.push('outbox_backlog_old');
      if (db.backlogGrowing) alerts.push('outbox_backlog_growing');
    }
    if (['down', 'unavailable'].includes(dependencies.redis.status))
      alerts.push('redis_unavailable');
    for (const [name, worker] of Object.entries(local.workers)) {
      // Uninstrumented/disabled workers remain unobserved, never falsely healthy/stopped.
      if (
        worker.lastRunAt !== null &&
        Date.now() - worker.lastRunAt >= LIMITS.workerStaleMs
      )
        alerts.push(`worker_stale:${name}`);
    }
    if (
      local.firebase.failingSince !== null &&
      Date.now() - local.firebase.failingSince >= LIMITS.firebaseFailureMs
    )
      alerts.push('firebase_failures_sustained');
    return {
      ...local,
      // Clone cached objects so a caller cannot mutate the shared dashboard cache.
      dependencies: structuredClone(dependencies),
      thresholds: LIMITS,
      alerts,
    };
  }
}
