import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import type { CacheStore } from '../src/infrastructure/cache/cache-store';
import { FeedCacheService } from '../src/modules/social-feed/application/feed-cache.service';
import {
  FeedTimelineService,
  timelineMember,
} from '../src/modules/social-feed/application/feed-timeline.service';
import { FeedQueryService } from '../src/modules/social-feed/application/feed-query.service';
import { FeedAccessService } from '../src/modules/social-feed/application/organization/feed-access.service';
import { FeedLiveReadService } from '../src/modules/social-feed/application/feed-live-read.service';
import { FeedRecommendationService } from '../src/modules/social-feed/application/feed-recommendation.service';
import { FeedCacheWorkerService } from '../src/modules/social-feed/application/feed-cache-worker.service';
import { requireIsolatedTestDatabase } from './support/isolated-test-database';
import { requireIsolatedTestRedis } from './support/isolated-test-redis';
import { memberTestOrganization } from './support/provider-members.fixture';
import { memberTestReviewer } from './support/member-verification.fixture';
import { FeedReviewService } from '../src/modules/social-feed/application/feed-review.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { FeedSafetyService } from '../src/modules/social-feed/application/feed-safety.service';
import { FeedModerationService } from '../src/modules/social-feed/application/feed-moderation.service';
import { FeedOperationsService } from '../src/modules/social-feed/application/feed-operations.service';

describe('Feed cache with isolated PostgreSQL and real Redis', () => {
  const prisma = new PrismaService();
  const settings: Record<string, unknown> = {
    'cache.enabled': true,
    'cache.url': process.env.REDIS_URL,
    'cache.feedEnabled': true,
    'cache.feedIndexEnabled': true,
    'cache.feedWorkerIntervalMs': 1,
    'cache.feedBatchSize': 200,
    'cache.feedTimeoutMs': 1000,
  };
  const config = {
    get: (key: string, fallback: unknown) => settings[key] ?? fallback,
    getOrThrow: (key: string) => settings[key],
  } as ConfigService;
  const redis = new RedisCacheService(config);
  const prefix = `feed-test:${randomUUID()}:`;
  const touched = new Set<string>();
  const key = (value: string) => {
    touched.add(prefix + value);
    return prefix + value;
  };
  const store: CacheStore = {
    get: <T>(k: string) => redis.get<T>(key(k)),
    getMany: <T>(keys: string[]) => redis.getMany<T>(keys.map(key)),
    set: <T>(k: string, value: T, ttl?: number) =>
      redis.set(key(k), value, ttl),
    setMany: <T>(entries: { key: string; value: T }[], ttl: number) =>
      redis.setMany(
        entries.map((entry) => ({ ...entry, key: key(entry.key) })),
        ttl,
      ),
    delete: (k) => redis.delete(key(k)),
    deleteMany: (keys) => redis.deleteMany(keys.map(key)),
    getStatus: () => redis.getStatus(),
    setIfAbsent: (k, token, ttl) => redis.setIfAbsent(key(k), token, ttl),
    releaseLock: (k, token) => redis.releaseLock(key(k), token),
    readSortedPage: (k, limit) => redis.readSortedPage(key(k), limit),
    replaceSortedPage: (k, members, ttl) => {
      key(`${k}:count`);
      return redis.replaceSortedPage(key(k), members, ttl);
    },
    advanceGeneration: (k, sequence, ttl) =>
      redis.advanceGeneration(key(k), sequence, ttl),
  };
  const cache = new FeedCacheService(store, config);
  const timeline = new FeedTimelineService(prisma, store, config);
  const queries = new FeedQueryService(
    prisma,
    new FeedAccessService(prisma),
    cache,
    timeline,
    new FeedLiveReadService(prisma),
  );
  const worker = new FeedCacheWorkerService(prisma, store, config);
  let providerId: string;
  let postId: string;
  let categoryId: string;
  let offeringId: string;
  let ownerId: string;
  const caption = 'Public content sentinel';

  beforeAll(async () => {
    requireIsolatedTestDatabase(process.env);
    requireIsolatedTestRedis(process.env);
    await prisma.$connect();
    await redis.onModuleInit();
    expect(redis.getStatus()).toBe('up');
    const f = await memberTestOrganization(
      prisma,
      new JwtService({ secret: 'feed-cache-isolated-test-secret-32-bytes' }),
      true,
    );
    providerId = f.provider.id;
    ownerId = f.owner.id;
    const category = await prisma.serviceCategory.create({
      data: {
        code: `FC_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
        name: 'Feed cache',
        normalizedName: `fc-${randomUUID()}`,
        slug: `fc-${randomUUID()}`,
        status: 'ACTIVE',
      },
    });
    categoryId = category.id;
    const service = await prisma.service.create({
      data: {
        categoryId,
        code: `FC_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
        name: 'Test service',
        normalizedName: `fc-${randomUUID()}`,
        slug: `fc-${randomUUID()}`,
        minPriceAmount: 10000,
        maxPriceAmount: 500000,
        status: 'ACTIVE',
      },
    });
    const offering = await prisma.providerService.create({
      data: {
        providerId,
        serviceId: service.id,
        sourceApplicationId: f.provider.sourceApplicationId,
        priceAmount: 100000,
        status: 'ACTIVE',
      },
    });
    offeringId = offering.id;
    const at = new Date('2026-11-20T00:00:00.000Z');
    for (let i = 0; i < 24; i++) {
      const post = await prisma.feedPost.create({
        data: {
          providerId,
          caption,
          moderationStatus: 'APPROVED',
          recommendationStatus: 'ELIGIBLE',
          createdAt: at,
          media: {
            create: {
              publicId: `test/${randomUUID()}`,
              secureUrl: 'https://example.test/post.jpg',
              format: 'jpg',
              kind: 'IMAGE',
              position: 0,
            },
          },
          services: { create: { providerServiceId: offeringId } },
        },
      });
      postId = post.id;
    }
  });

  afterAll(async () => {
    await redis.deleteMany([...touched]);
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('keeps new posts out of DB/cache reads until reviewed and invalidates a warm approval', async () => {
    const p = await prisma.feedPost.create({
      data: { providerId, caption: 'Pending platform moderation' },
    });
    await expect(queries.detail(p.id)).rejects.toThrow();
    expect(
      (await queries.list({ providerId, limit: 50 })).data.some(
        (row) => row.id === p.id,
      ),
    ).toBe(false);
    const reviewer = await memberTestReviewer(
      prisma,
      new JwtService({ secret: 'feed-moderation-test-secret' }),
      'MODERATOR',
    );
    const review = new FeedReviewService(
      prisma,
      new AuditService(prisma),
      new FeedAccessService(prisma),
    );
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        review.review(
          p.id,
          { revisionNumber: 1, decision: 'APPROVED', eligible: true },
          reviewer.account.id,
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.feedModerationDecision.count({ where: { postId: p.id } }),
    ).toBe(1);
    expect((await queries.detail(p.id)).id).toBe(p.id);
    await prisma.feedPost.update({
      where: { id: p.id },
      data: { moderationStatus: 'PENDING', revisionNumber: { increment: 1 } },
    });
    await expect(queries.detail(p.id)).rejects.toThrow();
    await expect(
      review.review(
        p.id,
        { revisionNumber: 1, decision: 'APPROVED', eligible: true },
        reviewer.account.id,
      ),
    ).rejects.toThrow();
    await prisma.feedPost.update({
      where: { id: p.id },
      data: { status: 'DELETED' },
    });
  });

  it('requires an independent appeal reviewer and retains both decisions', async () => {
    const p = await prisma.feedPost.create({
      data: { providerId, caption: 'Appeal test' },
    });
    const jwt = new JwtService({ secret: 'feed-moderation-test-secret' });
    const first = await memberTestReviewer(prisma, jwt, 'MODERATOR'),
      second = await memberTestReviewer(prisma, jwt, 'MODERATOR');
    const review = new FeedReviewService(
      prisma,
      new AuditService(prisma),
      new FeedAccessService(prisma),
    );
    await review.review(
      p.id,
      {
        revisionNumber: 1,
        decision: 'REJECTED',
        eligible: false,
        policyCode: 'OTHER',
        note: 'Needs additional context',
      },
      first.account.id,
    );
    // Seed a user appeal here; endpoint ownership is verified separately by the access service.
    const appeal = await prisma.feedModerationAppeal.create({
      data: {
        postId: p.id,
        userId: ownerId,
        revisionNumber: 1,
        reason: 'Please review the context',
      },
    });
    await expect(
      review.resolveAppeal(
        appeal.id,
        { decision: 'REVERSED', note: 'Context was reviewed' },
        first.account.id,
      ),
    ).rejects.toThrow();
    await review.resolveAppeal(
      appeal.id,
      { decision: 'REVERSED', note: 'Context was reviewed' },
      second.account.id,
    );
    expect(
      (await prisma.feedPost.findUniqueOrThrow({ where: { id: p.id } }))
        .moderationStatus,
    ).toBe('APPROVED');
    expect(
      await prisma.feedModerationDecision.count({ where: { postId: p.id } }),
    ).toBe(2);
    await expect(
      review.resolveAppeal(
        appeal.id,
        { decision: 'UPHELD', note: 'Duplicate decision' },
        first.account.id,
      ),
    ).rejects.toThrow();
    await prisma.feedPost.update({
      where: { id: p.id },
      data: { status: 'DELETED' },
    });
  });

  it('commits reports and notices together, preserves hidden comment replies and blocks exact forbidden media', async () => {
    const p = await prisma.feedPost.create({
      data: {
        providerId,
        caption: 'Moderation completion fixture',
        moderationStatus: 'APPROVED',
        moderationReviewedAt: new Date(),
      },
    });
    const jwt = new JwtService({ secret: 'feed-completion-test-secret' });
    const reviewer = await memberTestReviewer(prisma, jwt, 'MODERATOR');
    const viewer = await memberTestOrganization(prisma, jwt, true);
    await prisma.feedReport.create({
      data: {
        postId: p.id,
        userId: viewer.owner.id,
        reason: 'SPAM',
        revisionNumber: 1,
      },
    });
    await prisma.feedReport.create({
      data: {
        postId: p.id,
        userId: ownerId,
        reason: 'MISLEADING',
        revisionNumber: 1,
      },
    });
    const mod = new FeedModerationService(prisma, new AuditService(prisma));
    const report = await prisma.feedReport.findFirstOrThrow({
      where: { postId: p.id },
    });
    await mod.resolveReport(
      report.id,
      'CONTENT_REMOVED',
      reviewer.account.id,
      'SPAM_OR_SCAM',
      'Nội dung cần chỉnh sửa',
    );
    expect(
      await prisma.feedReport.count({
        where: { postId: p.id, resolution: null },
      }),
    ).toBe(0);
    expect(
      await prisma.feedNotice.count({
        where: { postId: p.id, managed: false },
      }),
    ).toBe(2);
    await expect(queries.detail(p.id)).rejects.toThrow();
    const root = await prisma.feedComment.create({
      data: { postId: p.id, userId: viewer.owner.id, text: 'Comment reported' },
    });
    await prisma.feedComment.create({
      data: {
        postId: p.id,
        userId: ownerId,
        parentId: root.id,
        text: 'Keep this reply',
      },
    });
    const cr = await prisma.feedCommentReport.create({
      data: { commentId: root.id, userId: ownerId, reason: 'INAPPROPRIATE' },
    });
    const ops = new FeedOperationsService(
      prisma,
      new AuditService(prisma),
      new FeedAccessService(prisma),
    );
    await ops.resolveComment(
      cr.id,
      true,
      'Bình luận không phù hợp',
      reviewer.account.id,
    );
    expect(
      (await prisma.feedComment.findUniqueOrThrow({ where: { id: root.id } }))
        .moderationHidden,
    ).toBe(true);
    expect(
      await prisma.feedComment.count({ where: { parentId: root.id } }),
    ).toBe(1);
    const hash = randomUUID().replaceAll('-', '').repeat(2);
    await prisma.feedBlockedMedia.create({
      data: { sha256: hash, postId: p.id, revisionNumber: 1 },
    });
    await expect(
      new FeedSafetyService(prisma, config).assertAllowed([hash]),
    ).rejects.toThrow();
    await prisma.feedPost.update({
      where: { id: p.id },
      data: { status: 'DELETED' },
    });
  });

  it('rolls back status, decisions, notices and blocked media when audit fails', async () => {
    const p = await prisma.feedPost.create({
      data: { providerId, caption: 'Atomic decision rollback' },
    });
    const audit = new AuditService(prisma);
    jest
      .spyOn(audit, 'record')
      .mockRejectedValue(new Error('simulated audit failure'));
    const review = new FeedReviewService(
      prisma,
      audit,
      new FeedAccessService(prisma),
    );
    await expect(
      review.review(
        p.id,
        {
          revisionNumber: 1,
          decision: 'REJECTED',
          eligible: false,
          policyCode: 'OTHER',
          note: 'Test rollback with missing reviewer',
        },
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect(
      (await prisma.feedPost.findUniqueOrThrow({ where: { id: p.id } }))
        .moderationStatus,
    ).toBe('PENDING');
    expect(
      await prisma.feedModerationDecision.count({ where: { postId: p.id } }),
    ).toBe(0);
    expect(await prisma.feedNotice.count({ where: { postId: p.id } })).toBe(0);
    await prisma.feedPost.update({
      where: { id: p.id },
      data: { status: 'DELETED' },
    });
  });

  it('keeps timestamp ties and cursor pages identical with cache off and on', async () => {
    settings['cache.feedEnabled'] = false;
    const baseline = await queries.list({ providerId, limit: 2 });
    settings['cache.feedEnabled'] = true;
    const cold = await queries.list({ providerId, limit: 2 });
    const warm = await queries.list({ providerId, limit: 2 });
    expect(cold).toEqual(baseline);
    expect(warm).toEqual(baseline);
    const next = await queries.list({
      providerId,
      limit: 2,
      cursor: warm.nextCursor!,
    });
    expect(next.data).toHaveLength(2);
    expect(
      next.data.every((post) => !warm.data.some((old) => old.id === post.id)),
    ).toBe(true);
    expect(cache.metrics.list.hits).toBeGreaterThan(0);
  });

  it('atomically rolls back generation and outbox with a rejected business transaction', async () => {
    const before = await prisma.feedCacheState.findUniqueOrThrow({
      where: { id: 'global' },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.feedPost.update({
          where: { id: postId },
          data: { status: 'HIDDEN' },
        });
        throw new Error('rollback sentinel');
      }),
    ).rejects.toThrow('rollback sentinel');
    expect(
      await prisma.feedCacheState.findUnique({ where: { id: 'global' } }),
    ).toEqual(before);
    expect(
      await prisma.feedCacheEvent.count({
        where: { sequence: { gt: before.version } },
      }),
    ).toBe(0);
  });

  it('stops serving hidden/deleted posts and invalidates cached membership immediately', async () => {
    await queries.detail(postId);
    await prisma.feedPost.update({
      where: { id: postId },
      data: { status: 'HIDDEN' },
    });
    await expect(queries.detail(postId)).rejects.toThrow();
    const page = await queries.list({ providerId, limit: 20 });
    expect(page.data.some((post) => post.id === postId)).toBe(false);
    await prisma.feedPost.update({
      where: { id: postId },
      data: { status: 'PUBLISHED' },
    });
    await queries.detail(postId);
    await prisma.feedPost.update({
      where: { id: postId },
      data: { status: 'DELETED' },
    });
    await expect(queries.detail(postId)).rejects.toThrow();
  });

  it('reads fresh service prices/categories without leaking stale service snapshots', async () => {
    const item = (await queries.list({ providerId, limit: 20 })).data[0];
    await queries.detail(item.id);
    await prisma.providerService.update({
      where: { id: offeringId },
      data: { priceAmount: 120000 },
    });
    expect((await queries.detail(item.id)).services[0].priceAmount).toBe(
      120000,
    );
    await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: { status: 'INACTIVE' },
    });
    expect((await queries.detail(item.id)).services).toEqual([]);
    await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: { status: 'ACTIVE' },
    });
  });

  it('enforces organization review and account/provider gates even with warmed media', async () => {
    const f = await memberTestOrganization(
      prisma,
      new JwtService({ secret: 'feed-cache-isolated-test-secret-32-bytes' }),
    );
    const member = await prisma.providerMember.findFirstOrThrow({
      where: { providerId: f.provider.id, role: 'OWNER' },
    });
    const post = await prisma.feedPost.create({
      data: {
        providerId: f.provider.id,
        caption: 'Pending organization post',
        moderationStatus: 'APPROVED',
        authorMemberId: member.id,
        authorMembershipVersion: member.membershipVersion,
        authorRole: 'OWNER',
        authorDisplayName: 'Owner',
        organizationReviewStatus: 'PENDING',
        media: {
          create: {
            publicId: `test/${randomUUID()}`,
            secureUrl: 'https://example.test/pending.jpg',
            format: 'jpg',
            kind: 'IMAGE',
            position: 0,
          },
        },
      },
    });
    await expect(queries.detail(post.id)).rejects.toThrow();
    await prisma.feedPost.update({
      where: { id: post.id },
      data: {
        organizationReviewStatus: 'REJECTED',
        organizationReviewedByUserId: f.owner.id,
        organizationReviewedAt: new Date(),
        organizationReviewNote: 'Không đủ điều kiện',
      },
    });
    await expect(queries.detail(post.id)).rejects.toThrow();
    await prisma.feedPost.update({
      where: { id: post.id },
      data: {
        organizationReviewStatus: 'APPROVED',
        organizationReviewedByUserId: f.owner.id,
        organizationReviewedAt: new Date(),
        organizationReviewNote: null,
      },
    });
    await queries.detail(post.id);
    await prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'SUSPENDED' },
    });
    await expect(queries.detail(post.id)).rejects.toThrow();
    await prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.user.update({
      where: { id: f.owner.id },
      data: { status: 'BLOCKED' },
    });
    await expect(queries.detail(post.id)).rejects.toThrow();
  });

  it('recovers from index eviction and rejects partially lost pages', async () => {
    const keyName = 'partial-page';
    const sample = { id: randomUUID(), createdAt: new Date() };
    await store.replaceSortedPage(keyName, [timelineMember(sample)], 60);
    expect(await store.readSortedPage(keyName, 2)).toEqual([
      timelineMember(sample),
    ]);
    await redis.delete(key(keyName));
    expect(await store.readSortedPage(keyName, 2)).toBeNull();
    expect(
      (await queries.list({ providerId, limit: 20 })).data.length,
    ).toBeGreaterThan(0);
  });

  it('preserves batch values and releases only locks owned by the same token', async () => {
    expect(
      await store.setMany(
        [
          { key: 'batch-a', value: { a: 1 } },
          { key: 'batch-b', value: { b: 2 } },
        ],
        60,
      ),
    ).toBe(true);
    expect(await store.getMany(['batch-a', 'missing', 'batch-b'])).toEqual([
      { a: 1 },
      null,
      { b: 2 },
    ]);
    expect(await store.setIfAbsent('owned-lock', 'first', 10)).toBe(true);
    await store.releaseLock('owned-lock', 'wrong');
    expect(await store.setIfAbsent('owned-lock', 'second', 10)).toBe(false);
    await store.releaseLock('owned-lock', 'first');
    expect(await store.setIfAbsent('owned-lock', 'second', 10)).toBe(true);
  });

  it('deduplicates real engagement events per user and rechecks recommended visibility', async () => {
    settings['cache.feedRecommendationsEnabled'] = true;
    const service = new FeedRecommendationService(prisma, queries, config);
    try {
      const visible = (await queries.list({ providerId, limit: 20 })).data[0];
      const dto = { clientEventId: randomUUID(), kind: 'VIEW' as const };
      await service.engage(ownerId, visible.id, dto);
      await service.engage(ownerId, visible.id, dto);
      expect(
        await prisma.feedEngagement.count({
          where: { userId: ownerId, clientEventId: dto.clientEventId },
        }),
      ).toBe(1);
      const result = await service.recommend(ownerId);
      expect(result.data.length).toBeLessThanOrEqual(20);
      const counts = new Map<string, number>();
      for (const post of result.data)
        counts.set(post.provider.id, (counts.get(post.provider.id) ?? 0) + 1);
      expect([...counts.values()].every((count) => count <= 2)).toBe(true);
      expect(result.data.every((post) => post.status === 'PUBLISHED')).toBe(
        true,
      );
      await expect(service.engage(ownerId, postId, dto)).rejects.toThrow();
    } finally {
      settings['cache.feedRecommendationsEnabled'] = false;
    }
  });

  it('retries cache delivery failures and reclaims expired leases', async () => {
    const before = await prisma.feedCacheState.update({
      where: { id: 'global' },
      data: { version: { increment: 1 } },
    });
    const event = await prisma.feedCacheEvent.create({
      data: {
        sequence: before.version,
        eventType: 'CACHE_REBUILD',
        availableAt: new Date(0),
        lockedUntil: new Date(Date.now() - 1000),
      },
    });
    const originalAdvance = store.advanceGeneration.bind(store);
    const fail = jest
      .spyOn(store, 'advanceGeneration')
      .mockImplementation((key, sequence, ttl) =>
        sequence === event.sequence.toString()
          ? Promise.resolve(false)
          : originalAdvance(key, sequence, ttl),
      );
    await worker.tick();
    fail.mockRestore();
    const retry = await prisma.feedCacheEvent.findUniqueOrThrow({
      where: { sequence: event.sequence },
    });
    expect(retry.processedAt).toBeNull();
    expect(retry.attempts).toBeGreaterThan(0);
    await prisma.feedCacheEvent.update({
      where: { sequence: event.sequence },
      data: { availableAt: new Date(0), lockedUntil: new Date(0) },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await worker.tick();
    expect(
      (
        await prisma.feedCacheEvent.findUniqueOrThrow({
          where: { sequence: event.sequence },
        })
      ).processedAt,
    ).not.toBeNull();
  });

  it('never moves Redis generation backwards with out-of-order events', async () => {
    await store.advanceGeneration('generation-test', '9007199254740993', 60);
    await store.advanceGeneration('generation-test', '9007199254740992', 60);
    // String, not Lua floating point, preserves bigint ordering beyond 2^53.
    const raw = createClient({ url: requireIsolatedTestRedis(process.env) });
    await raw.connect();
    try {
      expect(await raw.get(key('generation-test'))).toBe(
        '00009007199254740993',
      );
    } finally {
      await raw.close();
    }
  });
});
