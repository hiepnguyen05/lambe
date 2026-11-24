import {
  Controller,
  Get,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';

@Controller('ordinary')
class OrdinaryController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('HealthController readiness throttle isolation', () => {
  let app: INestApplication<Server>;
  const storage = {
    increment: jest
      .fn()
      .mockRejectedValue(
        new ServiceUnavailableException('Rate protection unavailable'),
      ),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          storage,
          throttlers: [
            { name: 'short', ttl: 1_000, limit: 10 },
            { name: 'medium', ttl: 60_000, limit: 120 },
          ],
        }),
      ],
      controllers: [HealthController, OrdinaryController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: HealthService,
          useValue: {
            check: () => ({
              status: 'degraded',
              services: { database: 'up', cache: 'down' },
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows health to report Redis down while keeping ordinary routes fail-closed', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({
        status: 'degraded',
        services: { database: 'up', cache: 'down' },
      });
    expect(storage.increment).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/api/ordinary').expect(503);
    expect(storage.increment).toHaveBeenCalledTimes(1);
  });
});
