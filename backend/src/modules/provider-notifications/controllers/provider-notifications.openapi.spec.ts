import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProviderNotificationsService } from '../application/provider-notifications.service';
import { ProviderNotificationsController } from './provider-notifications.controller';

describe('provider operational notification OpenAPI', () => {
  let app: INestApplication, document: OpenAPIObject;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProviderNotificationsController],
      providers: [
        { provide: ProviderNotificationsService, useValue: {} },
        { provide: RedisCacheService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth(undefined, 'user-token').build(),
    );
    await app.init();
  });
  afterAll(async () => app?.close());
  it('documents owner scope, the unread count and all four existing management routes', () => {
    const list = document.paths['/api/me/provider/notifications'].get!;
    expect(list.security).toEqual([{ 'user-token': [] }]);
    for (const status of ['200', '400', '401', '403'])
      expect(list.responses).toHaveProperty(status);
    expect(JSON.stringify(list.responses['200'])).toContain('unreadCount');
    expect(
      document.paths['/api/me/provider/notifications/{id}'].get,
    ).toBeDefined();
    expect(
      document.paths['/api/me/provider/notifications/{id}/read'].patch,
    ).toBeDefined();
  });
  it('documents SSE replay and no private names or financial amounts in the public push contract', () => {
    const stream = document.paths['/api/me/provider/notifications/events'].get!;
    expect(stream.description).toContain('sau commit');
    expect(stream.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'after', in: 'query' }),
      ]),
    );
    expect(
      JSON.stringify(
        document.paths['/api/me/provider/notifications'].get!.responses['200'],
      ),
    ).not.toContain('balanceAmount');
  });
});
