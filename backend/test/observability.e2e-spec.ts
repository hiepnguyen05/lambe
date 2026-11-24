import {
  Controller,
  Get,
  Module,
  Res,
  type INestApplication,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Response } from 'express';
import { get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { requestIdMiddleware } from '../src/common/http/middleware/request-id.middleware';
import { currentRequestId } from '../src/common/http/request-context';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { ObservabilityModule } from '../src/infrastructure/observability/observability.module';
import { ObservabilityMetrics } from '../src/infrastructure/observability/observability-metrics.service';
import { ObservabilityService } from '../src/infrastructure/observability/observability.service';
import { PostgresModule } from '../src/infrastructure/persistence/postgres/postgres.module';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { InternalAccessVerifierService } from '../src/modules/internal-auth/application/internal-access-verifier.service';
import { InternalJwtAuthGuard } from '../src/modules/internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../src/modules/internal-auth/guards/internal-roles.guard';
import { InternalAuthModule } from '../src/modules/internal-auth/internal-auth.module';

const jwt = new JwtService({
  secret: 'observability-test-only-secret',
  signOptions: { expiresIn: '5m' },
});

// Exercise production guards + JWT verifier, without mail/real database startup.
@Module({
  imports: [PostgresModule],
  providers: [
    InternalAccessVerifierService,
    InternalJwtAuthGuard,
    InternalRolesGuard,
    { provide: JwtService, useValue: jwt },
  ],
  exports: [
    InternalAccessVerifierService,
    InternalJwtAuthGuard,
    InternalRolesGuard,
  ],
})
class TestInternalAuthModule {}

@Controller('observability-fixture')
class FixtureController {
  @Get('items/:id')
  async item() {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return { requestId: currentRequestId() };
  }

  @Get('errors/:id')
  error(@Res() response: Response) {
    response.status(503).end();
  }

  @Get('streams/:id')
  stream(@Res() response: Response) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.flushHeaders();
    response.write(': ready\n\n');
    const timer = setTimeout(() => response.end(), 80);
    response.once('close', () => clearTimeout(timer));
  }
}

describe('Operational observability (isolated HTTP e2e)', () => {
  let app: INestApplication<Server>;
  let metrics: ObservabilityMetrics;
  let service: ObservabilityService;
  const rows = {
    pending: 4,
    retry: 2,
    failed: 1,
    pushRows: 6,
    failedRows: 1,
    oldestPush: new Date(Date.now() - 10_000),
    unpublished: 3,
    oldestNotice: new Date(),
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest
      .fn()
      .mockImplementation((query: { sql: string }) =>
        Promise.resolve(query.sql.includes('set_config') ? [] : [rows]),
      ),
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((work: (value: unknown) => unknown) => work(tx)),
    internalSession: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({
            id: where.id,
            accountId: 'private-account',
            revokedAt: where.id === 'revoked' ? new Date() : null,
            expiresAt: new Date(Date.now() + 60_000),
            account: {
              id: 'private-account',
              username: 'private-admin',
              status: 'ACTIVE',
              tokenVersion: 0,
              roles: [
                {
                  role: ['ADMIN', 'MODERATOR', 'SUPPORT'].includes(where.id)
                    ? where.id
                    : 'ADMIN',
                },
              ],
            },
          }),
        ),
    },
  };

  function token(sessionId = 'ADMIN', purpose = 'internal_access') {
    return jwt.sign({
      sub: 'private-account',
      username: 'private-admin',
      sessionId,
      tokenVersion: 0,
      purpose,
    });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
      controllers: [FixtureController],
    })
      .overrideModule(InternalAuthModule)
      .useModule(TestInternalAuthModule)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisCacheService)
      .useValue({ getStatus: () => 'up' })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(requestIdMiddleware);
    await app.listen(0, '127.0.0.1');
    metrics = app.get(ObservabilityMetrics);
    service = app.get(ObservabilityService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('denies anonymous/user tokens/revoked sessions and non-admin staff before reading metrics', async () => {
    const before = prisma.$transaction.mock.calls.length;
    await request(app.getHttpServer())
      .get('/api/admin/observability')
      .expect(401);
    for (const bearer of [
      'invalid-token',
      token('ADMIN', 'access'),
      token('revoked'),
    ]) {
      await request(app.getHttpServer())
        .get('/api/admin/observability')
        .set('Authorization', `Bearer ${bearer}`)
        .expect(401);
    }
    for (const role of ['MODERATOR', 'SUPPORT']) {
      await request(app.getHttpServer())
        .get('/api/admin/observability')
        .set('Authorization', `Bearer ${token(role)}`)
        .expect(403);
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(before);
  });

  it('propagates bounded request IDs concurrently and exposes aggregate templates only', async () => {
    await Promise.all(
      ['private-user-1', 'private-user-2'].map((id) =>
        request(app.getHttpServer())
          .get(`/api/observability-fixture/items/${id}?token=private-query`)
          .set('X-Request-Id', `request-${id}`)
          .expect(200)
          .expect({ requestId: `request-${id}` }),
      ),
    );
    await request(app.getHttpServer())
      .get('/api/observability-fixture/errors/private-order')
      .expect(503);
    await request(app.getHttpServer())
      .get('/api/private-unmatched?password=private-password')
      .expect(404);
    const response = await request(app.getHttpServer())
      .get('/api/admin/observability')
      .set('Authorization', `Bearer ${token()}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    const serialized = JSON.stringify(response.body);
    for (const secret of [
      'private-user',
      'private-query',
      'private-password',
      'private-order',
      'private-unmatched',
      'private-account',
      'private-admin',
      token(),
    ]) {
      expect(serialized).not.toContain(secret);
    }
    const snapshot = response.body as Awaited<
      ReturnType<ObservabilityService['snapshot']>
    >;
    expect(snapshot.dependencies.postgres).toMatchObject({
      status: 'up',
      push: { pending: 4, retry: 2 },
      orderNotices: { unpublished: 3 },
    });
    expect(snapshot.http.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: 'GET /api/observability-fixture/items/:id',
          completed: 2,
        }),
        expect.objectContaining({
          route: 'GET /api/admin/observability',
          clientErrors: 6,
        }),
        expect.objectContaining({ route: 'GET <unmatched>', clientErrors: 1 }),
      ]),
    );
    expect(currentRequestId()).toBeUndefined();
  });

  it('tracks SSE active/resume metadata and client aborts without server errors or cursor values', async () => {
    const address = app.getHttpServer().address() as AddressInfo;
    const incoming = await new Promise<import('node:http').IncomingMessage>(
      (resolve, reject) => {
        const client = get(
          `http://127.0.0.1:${address.port}/api/observability-fixture/streams/private-stream?after=private-cursor`,
          {
            headers: { 'Last-Event-ID': 'private-last-event' },
          },
          resolve,
        );
        client.once('error', reject);
      },
    );
    try {
      expect(
        metrics
          .snapshot()
          .http.routes.find((route) => route.route.endsWith('/streams/:id'))
          ?.sse.active,
      ).toBe(1);
    } finally {
      incoming.destroy();
    }
    await request(app.getHttpServer())
      .get('/api/observability-fixture/streams/another-private-stream')
      .expect(200);
    const snapshot = await service.snapshot();
    const stream = snapshot.http.routes.find((route) =>
      route.route.endsWith('/streams/:id'),
    )!.sse;
    expect(stream).toMatchObject({
      opened: 2,
      active: 0,
      resumeSignals: 1,
      aborted: 1,
      errors: 0,
      duration: { count: 2 },
    });
    expect(stream.duration.totalMs).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private-stream|private-cursor|private-last-event/,
    );
  });

  it.each([
    ['?after=private-resume', {}],
    ['?afterSequence=private-sequence', {}],
    ['', { 'Last-Event-ID': 'private-header' }],
  ])(
    'detects resume presence independently for %s without retaining values',
    async (query, headers) => {
      const before =
        metrics
          .snapshot()
          .http.routes.find((route) => route.route.endsWith('/streams/:id'))
          ?.sse.resumeSignals ?? 0;
      await request(app.getHttpServer())
        .get(`/api/observability-fixture/streams/private-resume-stream${query}`)
        .set(headers)
        .expect(200);
      const snapshot = metrics.snapshot();
      expect(
        snapshot.http.routes.find((route) =>
          route.route.endsWith('/streams/:id'),
        )?.sse.resumeSignals,
      ).toBe(before + 1);
      expect(JSON.stringify(snapshot)).not.toMatch(
        /private-resume|private-sequence|private-header/,
      );
    },
  );

  it('documents the standard response, internal authorization, rate limit and dependency errors', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const operation = document.paths['/api/admin/observability'].get!;
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(['200', '401', '403', '429', '503']),
    );
    expect(operation.security).toEqual([{ 'internal-token': [] }]);
  });
});
