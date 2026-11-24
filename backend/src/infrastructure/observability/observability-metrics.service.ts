import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  constants as performanceConstants,
  monitorEventLoopDelay,
  performance,
  PerformanceObserver,
  type IntervalHistogram,
  type PerformanceEntry,
} from 'node:perf_hooks';

export const OBSERVABILITY_LIMITS = {
  routeLabels: 128,
  queueRows: 10_000,
  cacheMs: 5_000,
  queryTimeoutMs: 750,
  querySampleEvery: 20,
  slowQueryMs: 250,
  backlogCount: 1_000,
  backlogAgeSeconds: 300,
  workerStaleMs: 60_000,
  firebaseFailureMs: 60_000,
} as const;

const DURATION_BUCKETS_MS = [10, 50, 100, 250, 500, 1_000, 5_000];
const WORKERS = ['push', 'order-notice-relay'] as const;
const PUSH_OUTCOMES = ['sent', 'retry', 'failed', 'token-invalid'] as const;
type Worker = (typeof WORKERS)[number];
type PushOutcome = (typeof PUSH_OUTCOMES)[number];

export const OPERATIONAL_EVENT_LABELS = {
  push: [...PUSH_OUTCOMES, 'delivery-error'],
  rematch: ['offered', 'selected', 'accepted'],
  'ai.intent': [
    'CONSULTATION',
    'PROVIDER_SEARCH',
    'PRICE_INQUIRY',
    'OUT_OF_SCOPE',
  ],
  'ai.cta': ['offered', 'selected'],
  'tracking.gps': ['accepted', 'stale', 'out-of-order'],
} as const;
type OperationalEvent = keyof typeof OPERATIONAL_EVENT_LABELS;
type RedisConnection = 'commands' | 'subscriber';
type RedisConnectionEvent = 'errors' | 'reconnects' | 'timeouts';
export type RedisCommandGroup =
  'read' | 'batchRead' | 'rateLimit' | 'publish' | 'write' | 'tracking';
export type CacheDomain = 'categories' | 'services' | 'feedPosts' | 'other';
type CacheOutcome = 'hits' | 'misses' | 'errors';

export function boundedHttpRoute(method: unknown, template: unknown) {
  const verb =
    typeof method === 'string' &&
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)
      ? method
      : 'OTHER';
  // Callers pass only the registered Express route path, never the request URL.
  const path =
    typeof template === 'string' &&
    template.length <= 240 &&
    /^\/[A-Za-z0-9_/:.{}*()-]*$/.test(template)
      ? template
      : '<unmatched>';
  return { verb, path, label: `${verb} ${path}` };
}

function timing() {
  return { count: 0, totalMs: 0, maxMs: 0, buckets: Array<number>(8).fill(0) };
}

function redisCommand() {
  return { duration: timing(), errors: 0, timeouts: 0 };
}

function observe(value: ReturnType<typeof timing>, duration: number) {
  const ms = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  value.count++;
  value.totalMs += ms;
  value.maxMs = Math.max(value.maxMs, ms);
  const bucket = DURATION_BUCKETS_MS.findIndex((limit) => ms <= limit);
  value.buckets[bucket < 0 ? 7 : bucket]++;
}

function routeStats() {
  return {
    completed: 0,
    aborted: 0,
    clientErrors: 0,
    serverErrors: 0,
    duration: timing(),
    sse: {
      opened: 0,
      active: 0,
      errors: 0,
      aborted: 0,
      resumeSignals: 0,
      messages: 0,
      duration: timing(),
    },
  };
}

@Injectable()
export class ObservabilityMetrics implements OnModuleInit, OnModuleDestroy {
  private readonly startedAt = new Date();
  private readonly startedAtMs = performance.now();
  private readonly eventLoop: IntervalHistogram = monitorEventLoopDelay({
    resolution: 20,
  });
  private readonly gc = {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    byKind: { minor: 0, major: 0, incremental: 0, weakCallbacks: 0, other: 0 },
  };
  private readonly gcObserver = new PerformanceObserver((items) => {
    for (const entry of items.getEntries()) this.recordGc(entry);
  });
  private activeHttp = 0;
  private readonly httpTotals = {
    completed: 0,
    aborted: 0,
    clientErrors: 0,
    serverErrors: 0,
  };
  private queryCount = 0;
  private slowQueryCount = 0;
  private readonly queryDuration = timing();
  private readonly redisCommands = {
    read: redisCommand(),
    batchRead: redisCommand(),
    rateLimit: redisCommand(),
    publish: redisCommand(),
    write: redisCommand(),
    tracking: redisCommand(),
  };
  private readonly redisConnections = {
    commands: { errors: 0, reconnects: 0, timeouts: 0 },
    subscriber: { errors: 0, reconnects: 0, timeouts: 0 },
  };
  private readonly cacheLookups = {
    categories: { hits: 0, misses: 0, errors: 0 },
    services: { hits: 0, misses: 0, errors: 0 },
    feedPosts: { hits: 0, misses: 0, errors: 0 },
    other: { hits: 0, misses: 0, errors: 0 },
  };
  private readonly routes = new Map<string, ReturnType<typeof routeStats>>();
  private readonly overflow = routeStats();
  private readonly workers = Object.fromEntries(
    WORKERS.map((name) => [
      name,
      { runs: 0, errors: 0, lastRunAt: null as number | null },
    ]),
  ) as Record<
    Worker,
    { runs: number; errors: number; lastRunAt: number | null }
  >;
  private readonly push = {
    sent: 0,
    retry: 0,
    failed: 0,
    'token-invalid': 0,
  };
  private readonly events = Object.fromEntries(
    Object.entries(OPERATIONAL_EVENT_LABELS).map(([event, labels]) => [
      event,
      Object.fromEntries(labels.map((label) => [label, 0])),
    ]),
  ) as Record<OperationalEvent, Record<string, number>>;
  private readonly firebase = {
    successes: 0,
    errors: 0,
    failingSince: null as number | null,
  };

  onModuleInit(): void {
    this.eventLoop.enable();
    this.gcObserver.observe({ entryTypes: ['gc'] });
  }

  onModuleDestroy(): void {
    this.eventLoop.disable();
    this.gcObserver.disconnect();
  }

  private recordGc(entry: PerformanceEntry): void {
    const detail = (entry as PerformanceEntry & { detail?: { kind?: number } })
      .detail;
    const kind = detail?.kind;
    const label =
      kind === performanceConstants.NODE_PERFORMANCE_GC_MINOR
        ? 'minor'
        : kind === performanceConstants.NODE_PERFORMANCE_GC_MAJOR
          ? 'major'
          : kind === performanceConstants.NODE_PERFORMANCE_GC_INCREMENTAL
            ? 'incremental'
            : kind === performanceConstants.NODE_PERFORMANCE_GC_WEAKCB
              ? 'weakCallbacks'
              : 'other';
    const duration = Number.isFinite(entry.duration)
      ? Math.max(0, entry.duration)
      : 0;
    this.gc.count++;
    this.gc.totalMs += duration;
    this.gc.maxMs = Math.max(this.gc.maxMs, duration);
    this.gc.byKind[label]++;
  }

  private eventLoopMilliseconds(value: number): number {
    return Number.isFinite(value) ? Number((value / 1_000_000).toFixed(3)) : 0;
  }

  private route(method: string, template: unknown) {
    const key = boundedHttpRoute(method, template).label;
    const existing = this.routes.get(key);
    if (existing) return existing;
    if (this.routes.size >= OBSERVABILITY_LIMITS.routeLabels)
      return this.overflow;
    const stats = routeStats();
    this.routes.set(key, stats);
    return stats;
  }

  startHttp(): void {
    this.activeHttp++;
  }

  recordPostgresQuery(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.queryCount++;
    if (durationMs >= OBSERVABILITY_LIMITS.slowQueryMs) this.slowQueryCount++;
    if (this.queryCount % OBSERVABILITY_LIMITS.querySampleEvery === 0) {
      observe(this.queryDuration, durationMs);
    }
  }

  recordRedisCommand(
    group: RedisCommandGroup,
    durationMs: number,
    failed: boolean,
    timedOut = false,
  ): void {
    const stats = this.redisCommands[group];
    observe(stats.duration, durationMs);
    if (failed) stats.errors++;
    if (timedOut) stats.timeouts++;
  }

  recordRedisConnection(
    connection: RedisConnection,
    event: RedisConnectionEvent,
  ): void {
    this.redisConnections[connection][event]++;
  }

  recordCacheLookup(domain: CacheDomain, outcome: CacheOutcome): void {
    if (!Object.hasOwn(this.cacheLookups, domain)) return;
    if (!['hits', 'misses', 'errors'].includes(outcome)) return;
    this.cacheLookups[domain][outcome]++;
  }

  finishHttp(
    method: string,
    template: unknown,
    status: number,
    ms: number,
    aborted: boolean,
  ): void {
    this.activeHttp = Math.max(0, this.activeHttp - 1);
    const stats = this.route(method, template);
    stats.completed++;
    this.httpTotals.completed++;
    if (aborted) {
      stats.aborted++;
      this.httpTotals.aborted++;
    }
    if (status >= 400 && status < 500) {
      stats.clientErrors++;
      this.httpTotals.clientErrors++;
    }
    if (status >= 500) {
      stats.serverErrors++;
      this.httpTotals.serverErrors++;
    }
    observe(stats.duration, ms);
  }

  startSse(method: string, template: unknown, resumed: boolean) {
    const stats = this.route(method, template).sse;
    stats.opened++;
    stats.active++;
    if (resumed) stats.resumeSignals++;
    let finished = false;
    let errored = false;
    return {
      error: () => {
        if (!finished && !errored) {
          errored = true;
          stats.errors++;
        }
      },
      message: () => {
        if (!finished) stats.messages++;
      },
      finish: (ms: number, aborted: boolean) => {
        if (finished) return;
        if (aborted) stats.aborted++;
        finished = true;
        stats.active--;
        observe(stats.duration, ms);
      },
    };
  }

  // Call even for empty polls. Fixed names/outcomes prevent caller-created labels.
  recordWorkerRun(worker: Worker, result: 'ok' | 'error'): void {
    if (!WORKERS.includes(worker) || !['ok', 'error'].includes(result)) return;
    const stats = this.workers[worker];
    stats.runs++;
    stats.lastRunAt = Date.now();
    if (result === 'error') stats.errors++;
  }

  recordPushOutcome(outcome: PushOutcome): void {
    this.recordEvent('push', outcome);
  }

  recordEvent<E extends OperationalEvent>(
    event: E,
    label: (typeof OPERATIONAL_EVENT_LABELS)[E][number],
  ): void {
    if (!Object.hasOwn(OPERATIONAL_EVENT_LABELS, event)) return;
    const allowed: readonly string[] = OPERATIONAL_EVENT_LABELS[event];
    if (!allowed.includes(label)) return;
    this.events[event][label]++;
    if (event === 'push' && Object.hasOwn(this.push, label)) {
      this.push[label as PushOutcome]++;
    }
  }

  recordFirebaseResult(result: 'ok' | 'error'): void {
    if (result === 'ok') {
      this.firebase.successes++;
      this.firebase.failingSince = null;
    } else if (result === 'error') {
      this.firebase.errors++;
      this.firebase.failingSince ??= Date.now();
    }
  }

  snapshot() {
    const memory = process.memoryUsage();
    const observedSeconds = (performance.now() - this.startedAtMs) / 1_000;
    return structuredClone({
      scope: 'process-local-since-start',
      startedAt: this.startedAt.toISOString(),
      process: {
        uptimeSeconds: process.uptime(),
        memoryBytes: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
        },
        cpuMicroseconds: process.cpuUsage(),
        eventLoopDelayMs: {
          samples: this.eventLoop.count,
          mean: this.eventLoopMilliseconds(this.eventLoop.mean),
          max: this.eventLoopMilliseconds(this.eventLoop.max),
          p50: this.eventLoopMilliseconds(
            this.eventLoop.count ? this.eventLoop.percentile(50) : 0,
          ),
          p95: this.eventLoopMilliseconds(
            this.eventLoop.count ? this.eventLoop.percentile(95) : 0,
          ),
          p99: this.eventLoopMilliseconds(
            this.eventLoop.count ? this.eventLoop.percentile(99) : 0,
          ),
        },
        gc: this.gc,
      },
      http: {
        active: this.activeHttp,
        totals: {
          ...this.httpTotals,
          requestsPerSecond:
            observedSeconds > 0
              ? Number((this.httpTotals.completed / observedSeconds).toFixed(3))
              : 0,
        },
        durationBucketUpperBoundsMs: [...DURATION_BUCKETS_MS, 'infinity'],
        // Buckets are non-cumulative. Overflow includes all labels beyond the cap.
        routes: [...this.routes].map(([route, stats]) => ({ route, ...stats })),
        overflow: this.overflow,
      },
      postgresQueries: {
        observed: this.queryCount,
        slow: this.slowQueryCount,
        durationBucketUpperBoundsMs: [...DURATION_BUCKETS_MS, 'infinity'],
        sampledDuration: this.queryDuration,
      },
      redis: {
        durationBucketUpperBoundsMs: [...DURATION_BUCKETS_MS, 'infinity'],
        commands: this.redisCommands,
        connections: this.redisConnections,
        cacheLookups: this.cacheLookups,
      },
      workers: this.workers,
      push: this.push,
      events: this.events,
      firebase: this.firebase,
    });
  }
}
