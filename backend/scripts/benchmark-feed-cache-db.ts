import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PublicFeedController } from '../src/modules/social-feed/controllers/public-feed.controller';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { FeedCacheService } from '../src/modules/social-feed/application/feed-cache.service';
import { FeedTimelineService } from '../src/modules/social-feed/application/feed-timeline.service';
import { FeedQueryService } from '../src/modules/social-feed/application/feed-query.service';
import { FeedAccessService } from '../src/modules/social-feed/application/organization/feed-access.service';
import { FeedLiveReadService } from '../src/modules/social-feed/application/feed-live-read.service';
import { publicFeedWhere } from '../src/modules/social-feed/domain/feed-visibility.policy';
import { requireIsolatedTestDatabase } from '../test/support/isolated-test-database';
import { measure } from './quality-baseline';

async function main() {
  requireIsolatedTestDatabase(process.env);
  if (process.env.REDIS_URL !== 'redis://localhost:6379/15')
    throw new Error('Use Redis DB 15');
  const hotKey = process.env.FEED_BENCH_HOT_KEY === 'true';
  const samples = hotKey ? 500 : 100;
  const concurrency = hotKey ? 20 : 5;
  const observer = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });
  observer.on('error', () => undefined);
  const memory = async () => {
    const info = await observer.info('memory');
    return {
      usedBytes: Number(/^used_memory:(\d+)/m.exec(info)?.[1] ?? 0),
      peakBytes: Number(/^used_memory_peak:(\d+)/m.exec(info)?.[1] ?? 0),
    };
  };
  const client = new PrismaClient({ log: [{ level: 'query', emit: 'event' }] });
  let queryCount = 0;
  let queryMs = 0;
  client.$on('query', (event) => {
    queryCount++;
    queryMs += event.duration;
  });
  const prisma = client as unknown as PrismaService;
  const settings: Record<string, unknown> = {
    'cache.enabled': true,
    'cache.url': process.env.REDIS_URL,
    'cache.feedEnabled': false,
    'cache.feedIndexEnabled': false,
  };
  const config = {
    get: (key: string, fallback: unknown) => settings[key] ?? fallback,
    getOrThrow: (key: string) => settings[key],
  } as ConfigService;
  const redis = new RedisCacheService(config);
  let app: INestApplication | undefined;
  try {
    await prisma.$connect();
    await redis.onModuleInit();
    await observer.connect();
    const cache = new FeedCacheService(redis, config);
    const queries = new FeedQueryService(
      prisma,
      new FeedAccessService(prisma),
      cache,
      new FeedTimelineService(prisma, redis, config),
      new FeedLiveReadService(prisma),
    );
    const module = await Test.createTestingModule({
      controllers: [PublicFeedController],
      providers: [
        { provide: FeedQueryService, useValue: queries },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const [largest] = await prisma.feedPost.groupBy({
      by: ['providerId'],
      where: publicFeedWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    const post = await prisma.feedPost.findFirst({
      where: { ...publicFeedWhere, providerId: largest?.providerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, providerId: true },
    });
    if (!post) throw new Error('Run Feed integration fixtures first');
    const output: object[] = [];
    for (const mode of ['off', 'objects', 'objects-and-index'] as const) {
      settings['cache.feedEnabled'] = mode !== 'off';
      settings['cache.feedIndexEnabled'] = mode === 'objects-and-index';
      for (const route of ['list', 'detail'] as const) {
        if (mode !== 'off') {
          const identities = await prisma.feedPost.findMany({
            where: { ...publicFeedWhere, providerId: post.providerId },
            select: { id: true, revisionNumber: true, updatedAt: true },
            take: 50,
          });
          await redis.deleteMany(
            identities.map(
              (row) =>
                `lambe:feed:v1:post:${row.id}:revision:${row.revisionNumber}:updated:${row.updatedAt.getTime()}`,
            ),
          );
          await prisma.$transaction(async (tx) => {
            const state = await tx.feedCacheState.update({
              where: { id: 'global' },
              data: { version: { increment: 1 } },
            });
            await tx.feedCacheEvent.create({
              data: { sequence: state.version, eventType: 'BENCHMARK_REBUILD' },
            });
          });
        }
        const run = async () => {
          const path =
            route === 'list'
              ? `/api/feed/posts?limit=20&providerId=${post.providerId}`
              : `/api/feed/posts/${post.id}`;
          const response = await fetch(`${url}${path}`);
          const body = (await response.json()) as { success?: boolean };
          if (!response.ok || body.success !== true)
            throw new Error('HTTP benchmark failed');
        };
        const coldAt = performance.now();
        const coldBurst = hotKey ? await measure(20, 20, run) : undefined;
        if (!hotKey) await run();
        const coldMs = performance.now() - coldAt;
        for (let i = 0; i < 20; i++) await run();
        const redisBefore = await memory();
        queryCount = 0;
        queryMs = 0;
        const cpuBefore = process.cpuUsage();
        const measured = await measure(samples, concurrency, run);
        const cpu = process.cpuUsage(cpuBefore);
        output.push({
          mode,
          route,
          coldMs: Number(coldMs.toFixed(3)),
          coldBurst,
          postgresQueries: queryCount,
          postgresQueryTotalMs: queryMs,
          processCpuMs: { user: cpu.user / 1000, system: cpu.system / 1000 },
          redisProcessMemory: { before: redisBefore, after: await memory() },
          ...measured,
        });
      }
    }
    console.log(
      JSON.stringify(
        {
          context:
            'local public HTTP probe; same provider/post; existing isolated fixtures; includes validation/envelope, excludes JWT/rate limiter and mobile; CPU includes API and load generator; Redis memory is shared across all DBs',
          profile: hotKey ? 'hot-key' : 'baseline',
          samples,
          concurrency,
          fixturePosts: largest?._count.id,
          at: new Date().toISOString(),
          measurements: output,
          cache: cache.metrics,
        },
        null,
        2,
      ),
    );
  } finally {
    await app?.close();
    await redis.onModuleDestroy();
    if (observer.isOpen) observer.destroy();
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  console.error(
    'Feed cache benchmark failed; verify isolated services and fixtures.',
  );
  process.exitCode = 1;
});
