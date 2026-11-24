import { type INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  getOptionsToken,
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import { basename } from 'node:path';
import { createClient } from 'redis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/bootstrap/configure-app';
import { CacheModule } from '../src/infrastructure/cache/cache.module';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { RedisThrottlerStorage } from '../src/infrastructure/cache/redis-throttler.storage';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { FirebaseAuthenticationService } from '../src/modules/auth/application/firebase-authentication.service';
import { UserRegistrationService } from '../src/modules/auth/application/user-registration.service';
import { UserProfileService } from '../src/modules/auth/application/user-profile.service';
import { UserSessionService } from '../src/modules/auth/application/user-session.service';
import { UserTokenService } from '../src/modules/auth/application/user-token.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { InternalTokenService } from '../src/modules/internal-auth/application/internal-token.service';
import { InternalJwtAuthGuard } from '../src/modules/internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../src/modules/internal-auth/guards/internal-roles.guard';
import { UploadController } from '../src/modules/upload/controllers/upload.controller';
import { UploadImageService } from '../src/modules/upload/application/upload-image.service';
import { AiConsultationController } from '../src/modules/ai-consultation/controllers/ai-consultation.controller';
import { AiConsultationService } from '../src/modules/ai-consultation/application/ai-consultation.service';
import { AiFeedbackService } from '../src/modules/ai-consultation/application/ai-feedback.service';
import { GeminiConsultationService } from '../src/modules/ai-consultation/infrastructure/gemini-consultation.service';
import type { TestAppContext } from './support/create-test-app';
import { requireIsolatedTestDatabase } from './support/isolated-test-database';

// No .env loading, cloud integrations, shared-DB cleanup, or NODE_ENV switching.
const testSettings = {
  NODE_ENV: 'test',
  REDIS_ENABLED: 'true',
  JWT_SECRET: 'quality-security-synthetic-user-key-20261030',
  INTERNAL_JWT_SECRET: 'quality-security-synthetic-internal-key-20261030',
  KYC_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  CLOUDINARY_ENABLED: 'false',
  FIREBASE_ENABLED: 'false',
  MAIL_ENABLED: 'false',
  MOMO_ENABLED: 'false',
  SEPAY_ENABLED: 'false',
  GEMINI_ENABLED: 'false',
  GEMINI_WEB_SEARCH_ENABLED: 'false',
  TRUST_PROXY: 'false',
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOuoAAAAASUVORK5CYII=',
  'base64',
);
const auth = (token: string) => `Bearer ${token}`;
type Account = { id: string; token: string; sessionId: string };

function isolatedTestTargets(env: NodeJS.ProcessEnv) {
  const invalid = () =>
    new Error(
      'Quality/security requires NODE_ENV=test, explicit matching DATABASE_URL and TEST_DATABASE_URL for a lambe_booking_test_* database, and an explicit Redis database 15 URL.',
    );
  try {
    requireIsolatedTestDatabase(env);
  } catch {
    throw invalid();
  }
  if (
    env.NODE_ENV !== 'test' ||
    !env.DATABASE_URL ||
    env.DATABASE_URL !== env.TEST_DATABASE_URL ||
    !env.REDIS_URL
  )
    throw invalid();
  let database: URL, redis: URL;
  try {
    database = new URL(env.DATABASE_URL);
    redis = new URL(env.REDIS_URL);
  } catch {
    throw invalid();
  }
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !/^\/lambe_booking_test_[a-z0-9_]+$/.test(database.pathname) ||
    !['redis:', 'rediss:'].includes(redis.protocol) ||
    redis.pathname !== '/15'
  )
    throw invalid();
  return {
    databaseUrl: env.DATABASE_URL,
    databaseName: database.pathname.slice(1),
    redisUrl: env.REDIS_URL,
  };
}

describe('Quality/security isolated target guard', () => {
  const localTargets = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://127.0.0.1:5432/lambe_booking_test_quality_regression_20261030_01',
    TEST_DATABASE_URL:
      'postgresql://127.0.0.1:5432/lambe_booking_test_quality_regression_20261030_01',
    REDIS_URL: 'redis://127.0.0.1:6379/15',
  };
  it('accepts injected loopback targets and derives the database name without replacing URLs', () => {
    expect(isolatedTestTargets(localTargets)).toEqual({
      databaseUrl: localTargets.DATABASE_URL,
      databaseName: 'lambe_booking_test_quality_regression_20261030_01',
      redisUrl: localTargets.REDIS_URL,
    });
  });
  it.each([
    { NODE_ENV: 'production' },
    { DATABASE_URL: undefined },
    { TEST_DATABASE_URL: undefined },
    { TEST_DATABASE_URL: `${localTargets.DATABASE_URL}_other` },
    {
      DATABASE_URL: localTargets.DATABASE_URL.replace('127.0.0.1', 'postgres'),
      TEST_DATABASE_URL: localTargets.TEST_DATABASE_URL.replace(
        '127.0.0.1',
        'postgres',
      ),
    },
    {
      DATABASE_URL: 'postgresql://postgres/app',
      TEST_DATABASE_URL: 'postgresql://postgres/app',
    },
    { DATABASE_URL: 'not-a-url', TEST_DATABASE_URL: 'not-a-url' },
    { REDIS_URL: undefined },
    { REDIS_URL: 'redis://redis:6379/0' },
  ])('rejects unsafe or missing target configuration: %j', (patch) => {
    expect(() => isolatedTestTargets({ ...localTargets, ...patch })).toThrow(
      'Quality/security requires',
    );
  });
});

describe('Quality/security evidence: full AppModule and real Redis throttling', () => {
  let c: TestAppContext;
  let owner: Account, outsider: Account, providerUser: Account;
  let adminToken: string, supportToken: string;
  let providerId: string, applicationId: string, documentId: string;
  let conversationId: string,
    aiId: string,
    postId: string,
    hiddenPostId: string;
  let orderId: string,
    evidenceId: string,
    categoryId: string,
    serviceId: string;
  const users: string[] = [],
    internalIds: string[] = [];
  const throttleApps: INestApplication<App>[] = [];
  const throttleNamespace = `quality-security-${randomUUID()}`;
  const savedSettings = new Map<string, string | undefined>();
  let envFileGuard: jest.SpyInstance;
  let redis: ReturnType<typeof createClient>;

  const http = () => request(c.app.getHttpServer());
  async function account(): Promise<Account> {
    const user = await c.prisma.user.create({
      data: {
        phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
        firebaseUid: `quality-${randomUUID()}`,
        fullName: 'Quality security synthetic user',
        roles: { create: { role: 'CUSTOMER' } },
      },
    });
    users.push(user.id);
    const session = await c.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    return {
      id: user.id,
      sessionId: session.id,
      token: c.app
        .get(UserTokenService)
        .generateAccessToken(user.id, user.phone, session.id),
    };
  }

  async function internal(role: 'ADMIN' | 'SUPPORT') {
    const username = `quality.${randomUUID()}`;
    const user = await c.prisma.internalAccount.create({
      data: {
        username,
        normalizedUsername: username,
        fullName: 'Synthetic internal',
        status: 'ACTIVE',
        mustChangePassword: false,
        roles: { create: { role } },
      },
      include: { roles: true, credential: true },
    });
    internalIds.push(user.id);
    const session = await c.prisma.internalSession.create({
      data: {
        accountId: user.id,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    return c.app
      .get(InternalTokenService)
      .generateAccessToken(user, session.id);
  }

  beforeAll(async () => {
    // Validate injected CI/host targets before importing AppModule or connecting.
    const targets = isolatedTestTargets(process.env);
    const existsSync = fs.existsSync.bind(fs);
    // Prisma's generated client independently probes .env even when Nest skips it.
    // Hide only secret env files from that probe; never open their contents.
    envFileGuard = jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) =>
        /^\.env(?:\.|$)/.test(basename(String(path)))
          ? false
          : existsSync(path),
      );
    for (const [key, value] of Object.entries({
      ...testSettings,
      DIRECT_URL: targets.databaseUrl,
    })) {
      savedSettings.set(key, process.env[key]);
      process.env[key] = value;
    }
    // AppModule is first imported after this interception. Real config factories
    // and validation still run; only reading local secret files is disabled.
    const forRoot = ConfigModule.forRoot.bind(ConfigModule);
    const configSpy = jest
      .spyOn(ConfigModule, 'forRoot')
      .mockImplementation((options = {}) =>
        forRoot({ ...options, ignoreEnvFile: true }),
      );
    try {
      const { createTestApp } = jest.requireActual<
        typeof import('./support/create-test-app')
      >('./support/create-test-app');
      c = await createTestApp();
    } finally {
      configSpy.mockRestore();
    }
    c.app.useLogger(false);
    await c.app.listen(0, '127.0.0.1');
    expect(c.app.get(RedisCacheService).getStatus()).toBe('up');
    const database = await c.prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;
    expect(database[0].name).toBe(targets.databaseName);
    redis = createClient({ url: targets.redisUrl });
    await redis.connect();
    owner = await account();
    outsider = await account();
    providerUser = await account();
    adminToken = await internal('ADMIN');
    supportToken = await internal('SUPPORT');
    const application = await c.prisma.providerApplication.create({
      data: {
        userId: providerUser.id,
        providerType: 'INDIVIDUAL',
        status: 'APPROVED',
      },
    });
    applicationId = application.id;
    const provider = await c.prisma.providerProfile.create({
      data: {
        userId: providerUser.id,
        sourceApplicationId: applicationId,
        providerType: 'INDIVIDUAL',
        displayName: 'Quality provider',
        status: 'ACTIVE',
      },
    });
    providerId = provider.id;
    const document = await c.prisma.providerApplicationDocument.create({
      data: {
        applicationId,
        type: 'ID_CARD_FRONT',
        fileUrl: 'https://example.test/quality-private.webp',
        publicId: `quality/private/${randomUUID()}`,
        fileFormat: 'webp',
        deliveryType: 'authenticated',
      },
    });
    documentId = document.id;
    const conversation = await c.prisma.chatConversation.create({
      data: {
        customerId: owner.id,
        providerId,
        lastSequence: 1,
        participants: {
          create: [{ userId: owner.id }, { userId: providerUser.id }],
        },
        messages: {
          create: {
            sequence: 1,
            senderUserId: owner.id,
            kind: 'TEXT',
            text: 'quality-private-chat-canary',
          },
        },
      },
    });
    conversationId = conversation.id;
    aiId = (
      await c.prisma.aiConversation.create({ data: { userId: owner.id } })
    ).id;
    const post = await c.prisma.feedPost.create({
      data: {
        providerId,
        caption: 'Quality public post',
        moderationStatus: 'APPROVED',
        reports: {
          create: {
            userId: owner.id,
            reason: 'PRIVACY',
            detail: 'quality-private-review-canary',
          },
        },
        media: {
          create: {
            kind: 'IMAGE',
            publicId: `quality/storage/${randomUUID()}`,
            secureUrl: 'https://example.test/public.png',
            format: 'png',
            position: 0,
          },
        },
      },
    });
    postId = post.id;
    hiddenPostId = (
      await c.prisma.feedPost.create({
        data: {
          providerId,
          caption: 'quality-hidden-post-canary',
          moderationStatus: 'APPROVED',
          status: 'HIDDEN',
        },
      })
    ).id;
    const key = randomUUID();
    categoryId = (
      await c.prisma.serviceCategory.create({
        data: {
          code: `Q_${key.replaceAll('-', '_').toUpperCase()}`,
          slug: key,
          name: key,
          normalizedName: key,
          status: 'ACTIVE',
        },
      })
    ).id;
    serviceId = (
      await c.prisma.service.create({
        data: {
          categoryId,
          code: `Q_${key.replaceAll('-', '_').toUpperCase()}`,
          slug: key,
          name: key,
          normalizedName: key,
          status: 'ACTIVE',
          minPriceAmount: 50000,
          maxPriceAmount: 200000,
        },
      })
    ).id;
    const offering = await c.prisma.providerService.create({
      data: {
        providerId,
        serviceId,
        sourceApplicationId: applicationId,
        priceAmount: 100000,
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });
    const start = new Date(Date.now() + 86_400_000);
    orderId = (
      await c.prisma.serviceOrder.create({
        data: {
          customerId: owner.id,
          providerId,
          providerServiceId: offering.id,
          bookingType: 'SCHEDULED',
          scheduledAt: start,
          expectedStartAt: start,
          expectedEndAt: new Date(start.getTime() + 1_800_000),
          serviceName: 'Quality service',
          servicePriceAmount: 100000,
          totalAmount: 100000,
          durationMinutes: 30,
          commissionRateBps: 1000,
          commissionAmount: 10000,
          addressLabel: 'Quality home',
          addressLine: 'quality-private-address-canary',
          addressLatitude: 10.77,
          addressLongitude: 106.7,
          contactPhone: '0390000000',
          providerResponseDeadlineAt: start,
        },
      })
    ).id;
    evidenceId = (
      await c.prisma.orderEvidence.create({
        data: {
          orderId,
          type: 'ARRIVAL',
          publicId: `quality/evidence/${key}`,
          fileFormat: 'png',
          uploadedByUserId: providerUser.id,
        },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    try {
      for (const app of throttleApps) await app.close();
      if (redis?.isOpen) {
        // Delete only this run's namespaced throttle keys, never shared DB15.
        const keys = await redis.keys(
          `lambe:throttle:*:${throttleNamespace}:*`,
        );
        if (keys.length) await redis.del(keys);
        await redis.close();
      }
      if (c) {
        await c.prisma.auditLog.deleteMany({
          where: {
            OR: [
              { actorUserId: { in: users } },
              { actorInternalAccountId: { in: internalIds } },
            ],
          },
        });
        if (orderId) {
          await c.prisma.orderEvidence.deleteMany({ where: { orderId } });
          await c.prisma.serviceOrder.deleteMany({ where: { id: orderId } });
        }
        if (conversationId) {
          await c.prisma.chatMessage.deleteMany({ where: { conversationId } });
          await c.prisma.chatParticipantState.deleteMany({
            where: { conversationId },
          });
          await c.prisma.chatConversation.deleteMany({
            where: { id: conversationId },
          });
        }
        if (aiId)
          await c.prisma.aiConversation.deleteMany({ where: { id: aiId } });
        await c.prisma.feedPost.deleteMany({
          where: { id: { in: [postId, hiddenPostId].filter(Boolean) } },
        });
        if (providerId) {
          await c.prisma.providerService.deleteMany({ where: { providerId } });
          await c.prisma.providerProfile.deleteMany({
            where: { id: providerId },
          });
        }
        if (applicationId)
          await c.prisma.providerApplication.deleteMany({
            where: { id: applicationId },
          });
        if (serviceId)
          await c.prisma.service.deleteMany({ where: { id: serviceId } });
        if (categoryId)
          await c.prisma.serviceCategory.deleteMany({
            where: { id: categoryId },
          });
        await c.prisma.userPushDevice.deleteMany({
          where: { userId: { in: users } },
        });
        await c.prisma.internalAccount.deleteMany({
          where: { id: { in: internalIds } },
        });
        await c.prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      await c?.app.close();
      envFileGuard?.mockRestore();
      jest.restoreAllMocks();
      for (const [key, value] of savedSettings) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it.each([
    '/api/auth/me',
    '/api/me/conversations',
    '/api/me/ai-conversations',
    '/api/me/feed/mine',
    '/api/me/orders',
    '/api/admin/auth/me',
    '/api/admin/internal-accounts',
  ])('requires a valid token at %s', async (path) => {
    await http().get(path).expect(401);
    await http()
      .get(path)
      .set('Authorization', 'Bearer malformed.jwt.value')
      .expect(401);
  });

  it('serves real PostgreSQL operational aggregates only to internal admins without private payloads', async () => {
    const response = await http()
      .get('/api/admin/observability')
      .set('Authorization', auth(adminToken))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    const data = (
      response.body as {
        data: {
          scope: string;
          dependencies: {
            postgres: { status: string; push: { backlog: number } };
          };
          http: { routes: unknown[] };
        };
      }
    ).data;
    expect(data.scope).toBe('process-local-since-start');
    expect(data.dependencies.postgres.status).toBe('up');
    expect(data.dependencies.postgres.push.backlog).toBeGreaterThanOrEqual(0);
    expect(data.http.routes.length).toBeLessThanOrEqual(128);
    const serialized = JSON.stringify(response.body);
    for (const secret of [
      'quality-private-chat-canary',
      'quality-private-review-canary',
      testSettings.JWT_SECRET,
      testSettings.INTERNAL_JWT_SECRET,
    ])
      expect(serialized).not.toContain(secret);
    await http().get('/api/admin/observability').expect(401);
    await http()
      .get('/api/admin/observability')
      .set('Authorization', auth(owner.token))
      .expect(401);
    await http()
      .get('/api/admin/observability')
      .set('Authorization', auth(supportToken))
      .expect(403);
  });

  it('keeps user/internal token domains and support/admin upload privileges separate', async () => {
    await http()
      .get('/api/admin/auth/me')
      .set('Authorization', auth(owner.token))
      .expect(401);
    await http()
      .get('/api/auth/me')
      .set('Authorization', auth(adminToken))
      .expect(401);
    await http()
      .get('/api/admin/internal-accounts')
      .set('Authorization', auth(supportToken))
      .expect(403);
    c.mediaStorage.uploadImage.mockClear();
    await http()
      .post('/api/admin/upload/image')
      .set('Authorization', auth(supportToken))
      .attach('file', png, 'valid.png')
      .expect(403);
    expect(c.mediaStorage.uploadImage).not.toHaveBeenCalled();
    await http()
      .get('/api/admin/auth/me')
      .set('Authorization', auth(supportToken))
      .expect(200);
  });

  it.each(['revoked', 'expired', 'disabled'] as const)(
    'rejects a real %s user session',
    async (kind) => {
      const user = await account();
      if (kind === 'disabled')
        await c.prisma.user.update({
          where: { id: user.id },
          data: { status: 'BLOCKED' },
        });
      else
        await c.prisma.userSession.update({
          where: { id: user.sessionId },
          data:
            kind === 'revoked'
              ? { revokedAt: new Date() }
              : { expiresAt: new Date(Date.now() - 1000) },
        });
      await http()
        .get('/api/auth/me')
        .set('Authorization', auth(user.token))
        .expect(401);
    },
  );

  it('rejects signed registration tokens, mismatched session subjects and a tampered signature', async () => {
    const tokens = c.app.get(UserTokenService);
    const ownerRow = await c.prisma.user.findUniqueOrThrow({
      where: { id: owner.id },
    });
    const registration = tokens.generateRegistrationToken(
      ownerRow.phone,
      ownerRow.firebaseUid!,
    );
    const wrongSubject = tokens.generateAccessToken(
      outsider.id,
      ownerRow.phone,
      owner.sessionId,
    );
    const [header, payload, signature] = owner.token.split('.');
    const tampered = `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    for (const token of [registration, wrongSubject, tampered]) {
      await http()
        .get('/api/auth/me')
        .set('Authorization', auth(token))
        .expect(401);
    }
  });

  it.each(['r'.repeat(100), 'quality.request-id_123'])(
    'preserves a bounded request ID on success and error: %s',
    async (id) => {
      for (const [path, status] of [
        ['/api/feed/posts', 200],
        ['/api/auth/me', 401],
      ] as const) {
        const response = await http()
          .get(path)
          .set('x-request-id', id)
          .expect(status)
          .expect('x-request-id', id);
        expect(JSON.stringify(response.body)).not.toMatch(
          /passwordHash|refreshTokenHash|stack|DATABASE_URL|postgres_password/,
        );
      }
    },
  );

  it.each(['r'.repeat(101), '<script>alert(1)</script>', 'contains spaces'])(
    'replaces an invalid request ID with a bounded UUID: %s',
    async (id) => {
      const response = await http()
        .get('/api/auth/me')
        .set('x-request-id', id)
        .expect(401);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers['x-request-id']).not.toBe(id);
    },
  );

  it('conceals existing chat, AI, booking and private document resources from nonowners', async () => {
    c.mediaStorage.createPrivateDownloadUrl.mockClear();
    const privatePaths = [
      `/api/me/conversations/${conversationId}`,
      `/api/me/conversations/${conversationId}/messages`,
      `/api/me/conversations/${conversationId}/events`,
      `/api/me/ai-conversations/${aiId}/messages`,
      `/api/me/orders/${orderId}`,
      `/api/orders/${orderId}/evidence/${evidenceId}`,
      `/api/provider-applications/${applicationId}/documents/${documentId}/access`,
    ];
    for (const path of privatePaths) {
      const response = await http()
        .get(path)
        .set('Authorization', auth(outsider.token))
        .expect(404);
      expect(JSON.stringify(response.body)).not.toMatch(
        /quality-private|signed-private|publicId|contactPhone|addressLine/,
      );
    }
    await http()
      .delete(`/api/me/ai-conversations/${aiId}`)
      .set('Authorization', auth(outsider.token))
      .expect(404);
    expect(await c.prisma.aiConversation.count({ where: { id: aiId } })).toBe(
      1,
    );
    expect(c.mediaStorage.createPrivateDownloadUrl).not.toHaveBeenCalled();
    await http()
      .get(`/api/me/conversations/${conversationId}/messages`)
      .set('Authorization', auth(owner.token))
      .expect(200);
    await http()
      .get(`/api/me/orders/${orderId}`)
      .set('Authorization', auth(owner.token))
      .expect(200);
    await http()
      .get(
        `/api/provider-applications/${applicationId}/documents/${documentId}/access`,
      )
      .set('Authorization', auth(providerUser.token))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(c.mediaStorage.createPrivateDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed IDs and input before invoking Gemini or storing writes', async () => {
    const analyze = jest.spyOn(c.app.get(GeminiConsultationService), 'analyze');
    for (const path of [
      '/api/me/conversations/not-a-uuid',
      '/api/me/ai-conversations/not-a-uuid/messages',
      '/api/me/orders/not-a-uuid',
    ]) {
      await http()
        .get(path)
        .set('Authorization', auth(owner.token))
        .expect(400);
    }
    for (const body of [
      { text: 'x'.repeat(1001), clientMessageId: randomUUID() },
      {
        text: 'Valid text',
        clientMessageId: randomUUID(),
        userId: outsider.id,
      },
      { text: 'Valid text', clientMessageId: 'invalid' },
    ]) {
      await http()
        .post(`/api/me/ai-conversations/${aiId}/messages`)
        .set('Authorization', auth(owner.token))
        .send(body)
        .expect(400);
    }
    await http()
      .post('/api/orders/quote')
      .set('Authorization', auth(owner.token))
      .send({
        providerServiceId: randomUUID(),
        bookingType: 'ASAP',
        inlineAddress: {
          label: 'Home',
          addressLine: 'Test address',
          latitude: 91,
          longitude: 181,
        },
        totalAmount: 1,
      })
      .expect(400);
    await http().get('/api/feed/posts').query({ limit: 51 }).expect(400);
    await http()
      .get('/api/feed/posts')
      .query({ cursor: 'invalid' })
      .expect(400);
    expect(analyze).not.toHaveBeenCalled();
    expect(
      await c.prisma.aiMessage.count({ where: { conversationId: aiId } }),
    ).toBe(0);
  });

  it('denies nonowner chat and AI writes before persistence or external calls', async () => {
    const analyze = jest.spyOn(c.app.get(GeminiConsultationService), 'analyze');
    const before = analyze.mock.calls.length;
    const chatBefore = await c.prisma.chatMessage.count({
      where: { conversationId },
    });
    await http()
      .post(`/api/me/conversations/${conversationId}/messages`)
      .set('Authorization', auth(outsider.token))
      .send({
        kind: 'TEXT',
        text: 'Unauthorized message',
        clientMessageId: randomUUID(),
      })
      .expect(404);
    await http()
      .post(`/api/me/ai-conversations/${aiId}/messages`)
      .set('Authorization', auth(outsider.token))
      .send({
        text: 'Unauthorized consultation',
        clientMessageId: randomUUID(),
      })
      .expect(404);
    expect(
      await c.prisma.chatMessage.count({ where: { conversationId } }),
    ).toBe(chatBefore);
    expect(
      await c.prisma.aiMessage.count({ where: { conversationId: aiId } }),
    ).toBe(0);
    expect(analyze.mock.calls.length).toBe(before);
  });

  it('denies nonowner order mutations without changing the order', async () => {
    const before = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, updatedAt: true },
    });
    await http()
      .post(`/api/me/orders/${orderId}/cancel`)
      .set('Authorization', auth(outsider.token))
      .send({ reason: 'Không thể tiếp tục' })
      .expect(404);
    await http()
      .post(`/api/me/orders/${orderId}/reschedule`)
      .set('Authorization', auth(outsider.token))
      .send({
        scheduledAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      })
      .expect(404);
    await http()
      .post(`/api/me/provider/orders/${orderId}/accept`)
      .set('Authorization', auth(outsider.token))
      .send({})
      .expect(404);
    const after = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, updatedAt: true },
    });
    expect(after).toEqual(before);
  });

  it('keeps public feed output free of private moderation, storage and account data', async () => {
    const response = await http().get(`/api/feed/posts/${postId}`).expect(200);
    expect(JSON.stringify(response.body)).not.toMatch(
      /quality-private|publicId|organizationReviewNote|organizationReviewedByUserId|phone|firebaseUid|refreshToken|membershipVersion/,
    );
    expect(response.body).toMatchObject({
      data: { id: postId, caption: 'Quality public post' },
    });
    await http().get(`/api/feed/posts/${hiddenPostId}`).expect(404);
    const list = await http()
      .get('/api/feed/posts')
      .query({ providerId })
      .expect(200);
    expect(JSON.stringify(list.body)).toContain(postId);
    expect(JSON.stringify(list.body)).not.toMatch(
      /quality-hidden-post-canary|quality-private-review-canary/,
    );
  });

  it('validates push registration and conceals the FCM token while enforcing revocation ownership', async () => {
    const token = `quality-fcm-${randomUUID()}`;
    const payload = { platform: 'ANDROID', deviceId: randomUUID(), token };
    await http().put('/api/me/push-devices').send(payload).expect(401);
    for (const patch of [
      { platform: 'INVALID' },
      { token: 'short' },
      { deviceId: '../bad' },
      { userId: outsider.id },
    ]) {
      await http()
        .put('/api/me/push-devices')
        .set('Authorization', auth(owner.token))
        .send({ ...payload, ...patch })
        .expect(400);
    }
    const registered = await http()
      .put('/api/me/push-devices')
      .set('Authorization', auth(owner.token))
      .send(payload)
      .expect(200);
    expect(JSON.stringify(registered.body)).not.toContain(token);
    expect(registered.body).not.toHaveProperty('data.token');
    const id = (registered.body as { data: { id: string } }).data.id;
    await http()
      .delete(`/api/me/push-devices/${id}`)
      .set('Authorization', auth(outsider.token))
      .expect(404);
    expect(
      (await c.prisma.userPushDevice.findUniqueOrThrow({ where: { id } }))
        .revokedAt,
    ).toBeNull();
    await http()
      .delete(`/api/me/push-devices/${id}`)
      .set('Authorization', auth(owner.token))
      .expect(200);
  });

  it.each([
    [
      'HTML disguised as PNG',
      Buffer.from('<html><script>alert(1)</script></html>'),
      'fake.png',
    ],
    [
      'scripted SVG',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
      'bad.svg',
    ],
    ['empty image', Buffer.alloc(0), 'empty.png'],
  ])(
    'runs the genuine HTTP upload content guard: %s',
    async (_label, bytes, filename) => {
      c.mediaStorage.uploadImage.mockClear();
      await http()
        .post('/api/admin/upload/image')
        .set('Authorization', auth(adminToken))
        .attach('file', bytes, { filename, contentType: 'image/png' })
        .expect(400);
      expect(c.mediaStorage.uploadImage).not.toHaveBeenCalled();
    },
  );

  it('accepts genuine PNG bytes, rejects excessive size/path input, and keeps private chat raster-only', async () => {
    c.mediaStorage.uploadImage.mockClear();
    await http()
      .post('/api/admin/upload/image')
      .set('Authorization', auth(adminToken))
      .attach('file', png, 'valid.png')
      .expect(201);
    expect(c.mediaStorage.uploadImage).toHaveBeenCalledWith(
      png,
      'lambe/general',
    );
    c.mediaStorage.uploadImage.mockClear();
    await http()
      .post('/api/admin/upload/image?folder=../private')
      .set('Authorization', auth(adminToken))
      .attach('file', png, 'valid.png')
      .expect(400);
    await http()
      .post('/api/admin/upload/image')
      .set('Authorization', auth(adminToken))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    expect(c.mediaStorage.uploadImage).not.toHaveBeenCalled();
    c.mediaStorage.uploadPrivateImage.mockClear();
    for (const bytes of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      Buffer.from('not an image'),
    ]) {
      await http()
        .post(`/api/me/conversations/${conversationId}/images`)
        .set('Authorization', auth(owner.token))
        .field('clientMessageId', randomUUID())
        .attach('files', bytes, 'fake.png')
        .expect(400);
    }
    expect(c.mediaStorage.uploadPrivateImage).not.toHaveBeenCalled();
    // Valid content cannot make an outsider reach private storage.
    await http()
      .post(`/api/me/conversations/${conversationId}/images`)
      .set('Authorization', auth(outsider.token))
      .field('clientMessageId', randomUUID())
      .attach('files', png, 'valid.png')
      .expect(404);
    expect(c.mediaStorage.uploadPrivateImage).not.toHaveBeenCalled();
  });

  async function throttledApp() {
    const production = c.app.get<ThrottlerModuleOptions>(getOptionsToken());
    if (Array.isArray(production))
      throw new Error('Review changed AppModule throttle configuration');
    const fixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRootAsync({
          imports: [CacheModule],
          inject: [RedisThrottlerStorage],
          useFactory: (storage: RedisThrottlerStorage) => ({
            ...production,
            storage,
            // Keep actual limits/TTLs and controller metadata; remove test bypass only.
            throttlers: production.throttlers.map((policy) => ({
              ...policy,
              skipIf: undefined,
            })),
            // Isolate keys from other agents while retaining controller/handler/IP scope.
            generateKey: (context, tracker, name) =>
              `${throttleNamespace}:${createHash('sha256').update(`${context.getClass().name}-${context.getHandler().name}-${name}-${tracker}`).digest('hex')}`,
          }),
        }),
      ],
      controllers: [AuthController, UploadController, AiConsultationController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        ...[
          FirebaseAuthenticationService,
          UserRegistrationService,
          UserProfileService,
          UserSessionService,
          UploadImageService,
          AiConsultationService,
          AiFeedbackService,
          JwtAuthGuard,
          InternalJwtAuthGuard,
          InternalRolesGuard,
        ].map((type) => ({ provide: type, useValue: c.app.get(type) })),
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(c.app.get(ConfigService))
      .overrideGuard(JwtAuthGuard)
      .useValue(c.app.get(JwtAuthGuard))
      .overrideGuard(InternalJwtAuthGuard)
      .useValue(c.app.get(InternalJwtAuthGuard))
      .overrideGuard(InternalRolesGuard)
      .useValue(c.app.get(InternalRolesGuard))
      .compile();
    const app = fixture.createNestApplication<INestApplication<App>>();
    throttleApps.push(app);
    // CacheModule needs the same explicit safe configuration as the full app.
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    expect(app.get(RedisCacheService).getStatus()).toBe('up');
    return app;
  }

  it('returns real Redis-backed 429s across app instances, resists spoofed XFF and recovers after the short window', async () => {
    const first = await throttledApp(),
      second = await throttledApp();
    const send = (app: INestApplication<App>, ip: string) =>
      request(app.getHttpServer())
        .post('/api/auth/firebase')
        .set('X-Forwarded-For', ip)
        .send({ idToken: 'invalid' });
    await send(first, '198.51.100.1').expect(400);
    await send(second, '198.51.100.2').expect(400);
    const allowed = await send(first, '198.51.100.3').expect(400);
    expect(allowed.headers['x-ratelimit-remaining-short']).toBe('0');
    await send(second, '198.51.100.4')
      .expect(429)
      .expect('Retry-After-short', '1');
    await delay(1100);
    await send(first, '198.51.100.5').expect(400);
    // Reuse the actual admin upload controller/guards; denied roles still consume the policy.
    for (let i = 0; i < 2; i++)
      await request(first.getHttpServer())
        .post('/api/admin/upload/image')
        .set('Authorization', auth(supportToken))
        .expect(403);
    await request(second.getHttpServer())
      .post('/api/admin/upload/image')
      .set('Authorization', auth(supportToken))
      .expect(429);
    const keys = await redis.keys(`lambe:throttle:*:${throttleNamespace}:*`);
    expect(keys.length).toBeGreaterThan(0);
  }, 20_000);

  it('enforces the reused AI medium policy after 20 requests, without calling Gemini', async () => {
    const app = await throttledApp(),
      peer = await throttledApp();
    const analyze = jest.spyOn(c.app.get(GeminiConsultationService), 'analyze');
    const before = analyze.mock.calls.length;
    for (let i = 0; i < 20; i++) {
      if (i === 9 || i === 18) await delay(1100);
      await request(app.getHttpServer())
        .post(`/api/me/ai-conversations/${aiId}/messages`)
        .set('Authorization', auth(owner.token))
        .send({ text: '', clientMessageId: randomUUID() })
        .expect(400);
    }
    await request(peer.getHttpServer())
      .post(`/api/me/ai-conversations/${aiId}/messages`)
      .set('Authorization', auth(owner.token))
      .send({ text: '', clientMessageId: randomUUID() })
      .expect(429)
      .expect((response) => {
        expect(Number(response.headers['retry-after-medium'])).toBeGreaterThan(
          0,
        );
      });
    expect(analyze.mock.calls.length).toBe(before);
  }, 20_000);
});
