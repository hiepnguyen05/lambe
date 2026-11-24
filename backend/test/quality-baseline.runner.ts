import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { get as httpGet, type ClientRequest } from 'node:http';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, PrismaClient, type ProviderService } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { fn, spyOn } from 'jest-mock';
import {
  measure,
  percentiles,
  preflight,
  currentFileDescriptors,
  type Options,
} from '../scripts/quality-baseline';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { FirebaseIdentityService } from '../src/infrastructure/firebase/firebase-identity.service';
import { GeminiConsultationService } from '../src/modules/ai-consultation/infrastructure/gemini-consultation.service';
import { FEED_MEDIA_STORAGE } from '../src/modules/social-feed/application/feed-media-storage.port';
import { OsrmRoutingService } from '../src/modules/orders/application/tracking/osrm-routing.service';
import { AiRecommendationsService } from '../src/modules/ai-consultation/application/ai-recommendations.service';
import { FeedQueryService } from '../src/modules/social-feed/application/feed-query.service';
import type { AiConsultationResult } from '../src/modules/ai-consultation/application/ai-consultation.service';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';
import type { TestAppContext } from './support/create-test-app';
import { createClient } from 'redis';

// Keep EXPLAIN numbers and node types only; Filter/Index Cond/Output can contain values.
export function safePlan(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safePlan);
  if (!value || typeof value !== 'object') return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry))
      output[key] = entry;
    else if (
      key === 'Node Type' &&
      typeof entry === 'string' &&
      /^[A-Za-z ]+$/.test(entry)
    )
      output[key] = entry;
    else if (['Plan', 'Plans', 'Planning', 'Triggers'].includes(key))
      output[key] = safePlan(entry);
  }
  return output;
}

export function queryFamily(query: string): string {
  const kind = /^\s*([A-Z]+)/i.exec(query)?.[1]?.toUpperCase() ?? 'OTHER';
  const table =
    /\b(?:FROM|UPDATE|INTO)\s+(?:"?[a-z_][a-z0-9_]*"?\.)?"?([a-z_][a-z0-9_]*)"?/i.exec(
      query,
    )?.[1] ?? 'none';
  return `${kind}:${table}`;
}

async function seed(c: TestAppContext, jwt: JwtService, options: Options) {
  const p = c.prisma;
  const customers: Awaited<ReturnType<typeof memberTestUser>>[] = [];
  for (let i = 0; i < Math.ceil(options.sse / 3); i++)
    customers.push(await memberTestUser(p, jwt));
  const category = await p.serviceCategory.create({
    data: {
      code: 'QUALITY_PERF',
      slug: 'quality-perf',
      name: 'Quality performance',
      normalizedName: 'quality performance',
      status: 'ACTIVE',
    },
  });
  const service = await p.service.create({
    data: {
      categoryId: category.id,
      code: 'QUALITY_PERF',
      slug: 'quality-perf',
      name: 'Quality performance',
      normalizedName: 'quality performance',
      minPriceAmount: 50000,
      maxPriceAmount: 500000,
      status: 'ACTIVE',
    },
  });
  const providers: (Awaited<ReturnType<typeof memberTestOrganization>> & {
    offering: ProviderService;
  })[] = [];
  for (let i = 0; i < options.providers; i++) {
    const f = await memberTestOrganization(p, jwt, true);
    await p.providerProfile.update({
      where: { id: f.provider.id },
      data: {
        setupCompletedAt: new Date(),
        serviceRadiusKm: 10,
        serviceAreaLatitude: 10.7731 + i / 100000,
        serviceAreaLongitude: 106.703,
        serviceAreaName: 'Synthetic area',
        workingHours: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            startMinute: 0,
            endMinute: 1440,
          })),
        },
      },
    });
    await p.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 1000000 },
    });
    const offering = await p.providerService.create({
      data: {
        providerId: f.provider.id,
        serviceId: service.id,
        sourceApplicationId: f.provider.sourceApplicationId,
        status: 'ACTIVE',
        priceAmount: 150000,
        durationMinutes: 45,
      },
    });
    providers.push({ ...f, offering });
    await p.feedPost.create({
      data: {
        providerId: f.provider.id,
        caption: 'Synthetic performance fixture',
        moderationStatus: 'APPROVED',
        media: {
          create: {
            kind: 'IMAGE',
            publicId: `quality/${i}`,
            secureUrl: 'https://example.test/quality.webp',
            format: 'webp',
            position: 0,
          },
        },
        services: { create: { providerServiceId: offering.id } },
      },
    });
  }
  const groupIds = Array.from({ length: Math.ceil(options.orders / 5) }, () =>
    randomUUID(),
  );
  const past = new Date(Date.now() - 7 * 86400000);
  for (let offset = 0; offset < options.orders; offset += 500) {
    await p.serviceOrder.createMany({
      data: Array.from(
        { length: Math.min(500, options.orders - offset) },
        (_, j) => {
          const i = offset + j,
            provider = providers[i % providers.length];
          return {
            bookingGroupId: groupIds[Math.floor(i / 5)],
            bookingAttempt: (i % 5) + 1,
            customerId: customers[0].id,
            providerId: provider.provider.id,
            providerServiceId: provider.offering.id,
            bookingType: 'ASAP',
            status: 'REJECTED',
            expectedStartAt: past,
            expectedEndAt: new Date(past.getTime() + 45 * 60000),
            serviceName: 'Quality performance',
            servicePriceAmount: 150000,
            subtotalAmount: 150000,
            totalAmount: 150000,
            durationMinutes: 45,
            commissionRateBps: 1000,
            commissionAmount: 15000,
            addressLabel: 'Synthetic',
            addressLine: 'Synthetic',
            addressLatitude: 10.7731,
            addressLongitude: 106.703,
            providerResponseDeadlineAt: past,
          };
        },
      ),
    });
  }
  const conversation = await p.chatConversation.create({
    data: {
      customerId: customers[0].id,
      providerId: providers[0].provider.id,
      lastSequence: options.messages,
      participants: {
        create: [customers[0].id, providers[0].owner.id].map((userId) => ({
          userId,
        })),
      },
    },
  });
  for (let offset = 0; offset < options.messages; offset += 500)
    await p.chatMessage.createMany({
      data: Array.from(
        { length: Math.min(500, options.messages - offset) },
        (_, j) => ({
          conversationId: conversation.id,
          sequence: offset + j + 1,
          senderUserId: customers[0].id,
          kind: 'TEXT',
          text: 'Synthetic baseline message',
        }),
      ),
    });
  const streams = [];
  for (let i = 0; i < options.sse; i++) {
    const customer = customers[Math.floor(i / 3)];
    const chat = await p.chatConversation.create({
      data: {
        customerId: customer.id,
        providerId: providers[(i + 1) % providers.length].provider.id,
        participants: { create: { userId: customer.id } },
      },
    });
    streams.push({ customer, chat });
  }
  // Mixed sent/failed/future/leased/pending rows exercise the actual outbox claim filter.
  await p.pushOutbox.createMany({
    data: Array.from({ length: options.orders }, (_, i) => ({
      userId: customers[0].id,
      deviceId: randomUUID(),
      deduplicationKey: `quality:${i}`,
      event: 'ORDER_REJECTED',
      entityType: 'ORDER',
      entityId: randomUUID(),
      recipientRole: 'CUSTOMER',
      sentAt: i % 5 === 0 ? past : null,
      failedAt: i % 5 === 1 ? past : null,
      availableAt: new Date(Date.now() + (i % 5 === 2 ? 86400000 : -60000)),
      lockedUntil: i % 5 === 3 ? new Date(Date.now() + 86400000) : null,
    })),
  });
  const posts = await c.app.get(AiRecommendationsService).posts([service.id]);
  const snapshot: AiConsultationResult = {
    clientMessageId: randomUUID(),
    reply: 'Synthetic advice',
    intent: 'CONSULTATION',
    suggestedServices: [
      {
        id: service.id,
        name: service.name,
        slug: service.slug,
        minPriceAmount: service.minPriceAmount,
        maxPriceAmount: service.maxPriceAmount,
        currencyCode: 'VND',
      },
    ],
    suggestedProviders: providers
      .slice(0, 6)
      .map((f) => ({ id: f.provider.id, service: { id: f.offering.id } })),
    suggestedPosts: posts,
    nextActions: [],
    followUpQuestion: null,
    conversionPrompt: null,
    nextAction: 'CONTINUE_CONSULTATION',
    degradedMode: false,
    citations: [],
  };
  const ai = [];
  for (const size of [1, 40]) {
    const row = await p.aiConversation.create({
      data: { userId: customers[0].id },
    });
    await p.aiMessage.createMany({
      data: Array.from({ length: size }, () => ({
        conversationId: row.id,
        role: 'assistant',
        text: 'Synthetic advice',
        result: snapshot as unknown as Prisma.InputJsonValue,
      })),
    });
    ai.push(row);
  }
  return { customers, providers, service, conversation, groupIds, streams, ai };
}

async function sseBaseline(
  c: TestAppContext,
  base: string,
  fixture: Awaited<ReturnType<typeof seed>>,
  fd: { connected: number | null; afterCleanup: number | null },
) {
  const sockets: ClientRequest[] = [];
  const handshake: number[] = [],
    delivery: number[] = [];
  let publishedAt = 0;
  let deadlineTimer: NodeJS.Timeout | undefined;
  try {
    const streams = fixture.streams.map(({ customer, chat }) => {
      let opened!: () => void,
        delivered!: () => void,
        fail!: (error: Error) => void;
      const ready = new Promise<void>((resolve) => {
        opened = resolve;
      });
      const received = new Promise<void>((resolve, reject) => {
        delivered = resolve;
        fail = reject;
      });
      // Attach rejection handling immediately; readiness can fail before delivery is awaited.
      void received.catch(() => undefined);
      const start = performance.now();
      const socket = httpGet(
        `${base}/api/me/conversations/${chat.id}/events?afterSequence=0`,
        { headers: { Authorization: `Bearer ${customer.token}` } },
        (response) => {
          if (
            response.statusCode !== 200 ||
            !response.headers['content-type']?.startsWith('text/event-stream')
          ) {
            fail(new Error('sse_status'));
            return;
          }
          handshake.push(performance.now() - start);
          opened();
          response.setEncoding('utf8');
          let buffer = '',
            done = false;
          response.on('data', (chunk: string) => {
            buffer += chunk;
            if (
              !done &&
              buffer.includes('\n\n') &&
              buffer.startsWith('id: 1\nevent: message\ndata: ') &&
              publishedAt
            ) {
              done = true;
              delivery.push(performance.now() - publishedAt);
              delivered();
            }
            if (buffer.length > 65536) fail(new Error('sse_buffer_limit'));
          });
          response.on('error', fail);
          response.on('end', () => fail(new Error('sse_ended')));
        },
      );
      socket.setTimeout(10000, () => socket.destroy(new Error('sse_timeout')));
      socket.on('error', fail);
      sockets.push(socket);
      return { ready, received };
    });
    // A bounded deadline also covers streams that fail before their headers arrive.
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(
        () => reject(new Error('sse_deadline')),
        12000,
      );
    });
    await Promise.race([
      Promise.all(streams.map((s) => Promise.race([s.ready, s.received]))),
      deadline,
    ]);
    const rssConnected = process.memoryUsage().rss;
    fd.connected = currentFileDescriptors();
    publishedAt = performance.now();
    for (const { customer, chat } of fixture.streams) {
      await c.prisma.chatMessage.create({
        data: {
          conversationId: chat.id,
          sequence: 1,
          senderUserId: customer.id,
          kind: 'TEXT',
          text: 'Synthetic stream message',
        },
      });
      await c.prisma.chatConversation.update({
        where: { id: chat.id },
        data: { lastSequence: 1 },
      });
      await c.app.get(RedisCacheService).publishChatUpdate(chat.id);
    }
    await Promise.race([Promise.all(streams.map((s) => s.received)), deadline]);
    assert.equal(delivery.length, fixture.streams.length);
    return {
      connections: streams.length,
      maxConnectionsPerUser: 3,
      handshakeMs: percentiles(handshake),
      batchInsertToAllClientsMs: percentiles(delivery),
      rssConnectedBytes: rssConnected,
    };
  } finally {
    clearTimeout(deadlineTimer);
    sockets.forEach((socket) => socket.destroy());
    await delay(50);
    fd.afterCleanup = currentFileDescriptors();
  }
}

export async function runBaseline(
  options: Options,
  setStage: (stage: string) => void,
) {
  // Called only after CLI preflight, but repeat before any connection or fixture write.
  preflight(process.argv.slice(2), process.env);
  Object.assign(process.env, {
    REDIS_ENABLED: 'true',
    FIREBASE_ENABLED: 'false',
    CLOUDINARY_ENABLED: 'false',
    MAIL_ENABLED: 'false',
    GEMINI_ENABLED: 'false',
    GEMINI_WEB_SEARCH_ENABLED: 'false',
    MOMO_ENABLED: 'false',
    SEPAY_ENABLED: 'false',
    OSRM_URL: '',
    JWT_SECRET: 'quality-baseline-synthetic-access-secret-only',
    INTERNAL_JWT_SECRET: 'quality-baseline-synthetic-internal-secret-only',
    KYC_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    PROVIDER_LOCATION_TTL_SECONDS: '600',
  });
  Object.assign(globalThis, { jest: { fn, spyOn } });
  Logger.overrideLogger(false);
  const redis = createClient({
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: false, connectTimeout: 3000 },
  });
  redis.on('error', () => undefined);
  const p = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: [{ emit: 'event', level: 'query' }],
  });
  let queries = 0;
  let capturedQueryFamilies: string[] | undefined;
  p.$on('query', (event) => {
    queries++;
    if (capturedQueryFamilies && capturedQueryFamilies.length < 32) {
      capturedQueryFamilies.push(queryFamily(event.query));
    }
  });
  let context: TestAppContext | undefined,
    lock = false;
  let stage = 'connect',
    rssPeak = process.memoryUsage().rss;
  const loop = monitorEventLoopDelay({ resolution: 10 });
  const report: Record<string, unknown> = {
    status: 'failed',
    startedAt: new Date().toISOString(),
    options,
    machine: {
      platform: platform(),
      release: release(),
      arch: arch(),
      cpuModel: cpus()[0]?.model,
      logicalCpus: cpus().length,
      totalMemoryBytes: totalmem(),
    },
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      prisma: Prisma.prismaVersion.client,
      execution: 'ts-node, same-process loopback HTTP',
      database: new URL(process.env.DATABASE_URL!).pathname.slice(1),
      redisDatabase: 15,
    },
  };
  const phase = (value: string) => {
    stage = value;
    setStage(value);
  };
  let restoreBuilder: (() => void) | undefined;
  let sampler: NodeJS.Timeout | undefined;
  try {
    phase('exclusive_redis');
    await redis.connect();
    assert.equal(await redis.dbSize(), 0, 'fresh_dedicated_redis15_required');
    lock =
      (await redis.set('lambe:quality-baseline:lock', 'quality-baseline', {
        NX: true,
        expiration: { type: 'EX', value: 900 },
      })) === 'OK';
    assert(lock);
    phase('empty_migrated_database');
    await p.$connect();
    const [database] = await p.$queryRaw<
      Array<{ name: string; version: string }>
    >`SELECT current_database() AS name, current_setting('server_version') AS version`;
    assert.equal(
      database.name,
      new URL(process.env.DATABASE_URL!).pathname.slice(1),
    );
    assert.equal(
      (await p.user.count()) +
        (await p.serviceOrder.count()) +
        (await p.serviceCategory.count()),
      0,
    );
    report.services = {
      postgresVersion: database.version,
      redisVersion: /^redis_version:([^\r\n]+)/m.exec(
        await redis.info('server'),
      )?.[1],
    };
    phase('test_app');
    const originalBuilder = Test.createTestingModule.bind(Test);
    const builderSpy = spyOn(Test, 'createTestingModule').mockImplementation(
      (metadata) =>
        originalBuilder(metadata)
          .overrideProvider(PrismaService)
          .useValue(p)
          .overrideProvider(FirebaseIdentityService)
          .useValue({
            getFirebaseApp: fn(() => {
              throw new Error('firebase_disabled');
            }),
          })
          .overrideProvider(GeminiConsultationService)
          .useValue({
            analyze: fn<() => Promise<null>>().mockResolvedValue(null),
          })
          .overrideProvider(FEED_MEDIA_STORAGE)
          .useValue({
            uploadFeedImage: fn(() => {
              throw new Error('media_disabled');
            }),
            uploadFeedVideo: fn(() => {
              throw new Error('media_disabled');
            }),
            deleteImage: fn<() => Promise<boolean>>().mockResolvedValue(true),
            deleteFeedVideo:
              fn<() => Promise<boolean>>().mockResolvedValue(true),
          })
          .overrideProvider(OsrmRoutingService)
          .useValue({
            getRoute: fn<() => Promise<null>>().mockResolvedValue(null),
          }),
    );
    restoreBuilder = () => builderSpy.mockRestore();
    // Import only now: AppModule reads environment during module evaluation.
    const { createTestApp } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./support/create-test-app') as typeof import('./support/create-test-app');
    context = await createTestApp();
    builderSpy.mockRestore();
    restoreBuilder = undefined;
    const c = context,
      cache = c.app.get(RedisCacheService);
    assert.equal(cache.getStatus(), 'up');
    const timers = c.app.get(SchedulerRegistry);
    for (const name of timers.getCronJobs().keys()) timers.deleteCronJob(name);
    for (const name of timers.getIntervals()) timers.deleteInterval(name);
    for (const name of timers.getTimeouts()) timers.deleteTimeout(name);
    await c.app.listen(0, '127.0.0.1');
    const base = await c.app.getUrl();
    const jwt = new JwtService({
      secret: c.app.get(ConfigService).getOrThrow<string>('security.jwtSecret'),
    });
    phase('seed');
    const fixture = await seed(c, jwt, options);
    // Seed is intentionally retained for parent inspection/drop; no truncate or appDB access.
    report.dataset = {
      providers: await p.providerProfile.count(),
      providerType: 'INDIVIDUAL',
      orders: await p.serviceOrder.count(),
      orderStatus: 'REJECTED',
      bookingGroups: fixture.groupIds.length,
      chatMessages: await p.chatMessage.count(),
      feedPosts: await p.feedPost.count(),
      aiMessages: await p.aiMessage.count(),
      pushOutbox: await p.pushOutbox.count(),
      synthetic: true,
    };
    for (const table of [
      'service_orders',
      'chat_messages',
      'push_outbox',
      'provider_profiles',
      'feed_posts',
    ])
      await p.$executeRawUnsafe(`ANALYZE "${table}"`);
    let geoSequence = Date.now();
    const refreshGeo = async () => {
      for (const f of fixture.providers) {
        const capturedAtMs = (geoSequence = Math.max(
          geoSequence + 1,
          Date.now(),
        ));
        await cache.upsert({
          providerId: f.provider.id,
          sessionId: f.provider.id,
          latitude: 10.7731,
          longitude: 106.703,
          accuracyMeters: 5,
          capturedAtMs,
          sequence: capturedAtMs,
        });
      }
    };
    await refreshGeo();
    sampler = setInterval(() => {
      rssPeak = Math.max(rssPeak, process.memoryUsage().rss);
    }, 25);
    loop.enable();
    const utilization = performance.eventLoopUtilization();
    const http = () => request(c.app.getHttpServer());
    const discovery: Record<string, unknown> = {};
    for (const bookingType of ['ASAP', 'SCHEDULED']) {
      phase(`discovery_${bookingType.toLowerCase()}`);
      await refreshGeo();
      const body = {
        serviceId: fixture.service.id,
        bookingType,
        latitude: 10.7731,
        longitude: 106.703,
        radiusKm: 10,
        limit: 20,
        ...(bookingType === 'SCHEDULED'
          ? { scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString() }
          : {}),
      };
      let cards = 0;
      const run = async () => {
        const response = await http()
          .post('/api/discovery/providers/search')
          .set('Authorization', `Bearer ${fixture.customers[0].token}`)
          .send(body)
          .timeout(10000);
        assert.equal(response.status, 200);
        const data = (response.body as { data: unknown[] }).data;
        assert.equal(data.length, Math.min(20, options.providers));
        cards = data.length;
      };
      await measure(options.warmup, 1, run);
      discovery[bookingType] = {
        ...(await measure(options.samples, options.concurrency, run)),
        returnedCards: cards,
      };
    }
    report.discovery = discovery;
    phase('query_counts');
    const count = async (run: () => Promise<number>) => {
      // Prisma delivers query log events asynchronously; drain the previous phase first.
      await delay(25);
      const before = queries;
      capturedQueryFamilies = [];
      try {
        const rows = await run();
        await delay(25);
        return {
          rows,
          sqlQueries: queries - before,
          sqlFamilies: capturedQueryFamilies,
        };
      } finally {
        capturedQueryFamilies = undefined;
      }
    };
    const ai = [];
    for (const conversation of fixture.ai)
      ai.push(
        await count(async () => {
          const res = await http()
            .get(`/api/me/ai-conversations/${conversation.id}/messages`)
            .set('Authorization', `Bearer ${fixture.customers[0].token}`)
            .timeout(10000);
          assert.equal(res.status, 200);
          return (res.body as { data: unknown[] }).data.length;
        }),
      );
    const feed = [];
    for (const limit of [1, Math.min(20, options.providers)])
      feed.push(
        await count(async () => {
          const res = await c.app
            .get(FeedQueryService)
            .list({ limit }, fixture.customers[0].id);
          return res.data.length;
        }),
      );
    report.queryCounts = {
      aiHistory: ai,
      authenticatedFeedService: feed,
      upperBound: 20,
      allowedGrowth: 0,
      includesPrismaRelationQueries: true,
    };
    assert.deepEqual(
      ai.map((row) => row.rows),
      [1, 40],
    );
    assert.deepEqual(
      feed.map((row) => row.rows),
      [1, Math.min(20, options.providers)],
    );
    for (const pair of [ai, feed]) {
      assert(pair[0].sqlQueries > 0 && pair[1].sqlQueries <= 20);
      assert(pair[1].sqlQueries <= pair[0].sqlQueries, 'query_count_growth');
    }
    phase('sse');
    const fileDescriptors = {
      status:
        process.platform === 'linux' ? 'measured' : 'unsupported_platform',
      source: process.platform === 'linux' ? '/proc/self/fd' : null,
      beforeSse: currentFileDescriptors(),
      connected: null as number | null,
      afterCleanup: null as number | null,
      allowedGrowth: 8,
      cleanupWithinBound: null as boolean | null,
    };
    report.resources = { fileDescriptors };
    report.sse = await sseBaseline(c, base, fixture, fileDescriptors);
    const fdMeasured =
      fileDescriptors.beforeSse !== null &&
      fileDescriptors.connected !== null &&
      fileDescriptors.afterCleanup !== null;
    if (
      fileDescriptors.beforeSse !== null &&
      fileDescriptors.afterCleanup !== null
    )
      fileDescriptors.cleanupWithinBound =
        fileDescriptors.afterCleanup <=
        fileDescriptors.beforeSse + fileDescriptors.allowedGrowth;
    if (process.platform === 'linux' && !fdMeasured)
      fileDescriptors.status = 'unavailable';
    report.resources = {
      fileDescriptors,
      rssPeakBytes: Math.max(rssPeak, process.memoryUsage().rss),
      rssFinalBytes: process.memoryUsage().rss,
      eventLoopDelayMs: {
        p50: loop.percentile(50) / 1e6,
        p95: loop.percentile(95) / 1e6,
        p99: loop.percentile(99) / 1e6,
        max: loop.max / 1e6,
      },
      eventLoopUtilization:
        performance.eventLoopUtilization(utilization).utilization,
      scope:
        'after seed: discovery, query counts and SSE; 10ms loop resolution, 25ms RSS sampling',
    };
    if (process.platform === 'linux')
      assert(
        fdMeasured && fileDescriptors.cleanupWithinBound,
        'fd_cleanup_bound',
      );
    loop.disable();
    phase('explain');
    const explain = async (query: Prisma.Sql) =>
      safePlan(
        (
          await p.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>(
            Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
          )
        )[0]['QUERY PLAN'],
      );
    report.explain = {
      chatAfterSequence: await explain(
        Prisma.sql`SELECT * FROM chat_messages WHERE "conversationId" = ${fixture.conversation.id} AND sequence > ${options.messages - 100} ORDER BY sequence ASC LIMIT 51`,
      ),
      rematchProviderAttempts: await explain(
        Prisma.sql`SELECT "providerId", "assignedMemberId" FROM service_orders WHERE "bookingGroupId" = ${fixture.groupIds[0]}`,
      ),
      rematchLatestAttempt: await explain(
        Prisma.sql`SELECT id FROM service_orders WHERE "bookingGroupId" = ${fixture.groupIds[0]} ORDER BY "bookingAttempt" DESC LIMIT 1`,
      ),
      // Same locking claim shape as PushOutboxService; rollback avoids changing attempts/leases.
      pushOutboxClaim: await p.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SAVEPOINT quality_explain');
        const plan = safePlan(
          (
            await tx.$queryRaw<
              Array<{ 'QUERY PLAN': unknown }>
            >(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          WITH candidate AS (SELECT id FROM push_outbox WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "availableAt" <= NOW()
            AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW()) ORDER BY "availableAt", id FOR UPDATE SKIP LOCKED LIMIT 1)
          UPDATE push_outbox AS push SET "lockedUntil" = NOW() + INTERVAL '2 minutes', attempts = push.attempts + 1 FROM candidate WHERE push.id = candidate.id RETURNING push.*`)
          )[0]['QUERY PLAN'],
        );
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT quality_explain');
        return plan;
      }),
    };
    report.status = 'passed';
  } catch {
    report.failedStage = stage;
    report.error =
      'Baseline failed; raw application/database errors intentionally suppressed.';
  } finally {
    phase('cleanup');
    loop.disable();
    if (sampler) clearInterval(sampler);
    restoreBuilder?.();
    try {
      await context?.app.close();
      await p.$disconnect();
      if (lock && redis.isReady) {
        // Only this run's fresh Redis DB was reserved; remove exact GEO/lock keys, never FLUSHDB.
        await redis.del([
          'lambe:providers:online:geo',
          'lambe:providers:online:heartbeat',
          'lambe:quality-baseline:lock',
        ]);
      }
    } catch {
      report.status = 'failed';
      report.cleanupError = true;
    } finally {
      if (redis.isOpen) redis.destroy();
    }
    report.completedAt = new Date().toISOString();
  }
  return report;
}
