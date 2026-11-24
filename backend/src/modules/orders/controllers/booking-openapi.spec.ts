import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProviderDiscoveryService } from '../../discovery/application/provider-discovery.service';
import { ProviderDiscoveryController } from '../../discovery/controllers/provider-discovery.controller';
import { OrdersService } from '../application/orders.service';
import { OrderCancellationService } from '../application/cancellation/order-cancellation.service';
import { OrderReviewService } from '../application/reviews/order-review.service';
import { OrderEvidenceService } from '../application/evidence/order-evidence.service';
import { OrderNotificationsService } from '../application/notifications/order-notifications.service';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { OrderPaymentDisputeService } from '../application/payments/order-payment-dispute.service';
import { BookingAvailabilityService } from '../application/scheduling/booking-availability.service';
import { OrderRescheduleService } from '../application/scheduling/order-reschedule.service';
import { BookingCalendarController } from './booking-calendar.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { ProviderOrdersController } from './provider-orders.controller';
import { OrderEvidenceController } from './order-evidence.controller';
import { OrderNotificationsController } from './order-notifications.controller';
import { ProviderReviewsController } from './provider-reviews.controller';

describe('booking OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        CustomerOrdersController,
        ProviderOrdersController,
        BookingCalendarController,
        ProviderDiscoveryController,
        OrderEvidenceController,
        OrderNotificationsController,
        ProviderReviewsController,
      ],
      providers: [
        { provide: OrdersService, useValue: {} },
        { provide: BookingAvailabilityService, useValue: {} },
        { provide: OrderRescheduleService, useValue: {} },
        { provide: ProviderDiscoveryService, useValue: {} },
        { provide: OrderCancellationService, useValue: {} },
        { provide: OrderReviewService, useValue: {} },
        { provide: OrderEvidenceService, useValue: {} },
        { provide: OrderNotificationsService, useValue: {} },
        { provide: RedisCacheService, useValue: {} },
        { provide: OrderPaymentDisputeService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Booking contract test')
        .addBearerAuth(undefined, 'user-token')
        .build(),
    );
  });
  afterAll(async () => app?.close());

  it('documents scoped public member reviews, bounded pagination and review creation conflicts', () => {
    const member =
      document.paths['/api/providers/{providerId}/members/{memberId}/reviews']
        .get!;
    expect(member.responses).toHaveProperty('200');
    expect(member.responses).toHaveProperty('400');
    expect(member.responses).toHaveProperty('404');
    expect(member.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'path',
          name: 'providerId',
          required: true,
        }),
        expect.objectContaining({
          in: 'path',
          name: 'memberId',
          required: true,
        }),
        expect.objectContaining({ in: 'query', name: 'limit' }),
        expect.objectContaining({ in: 'query', name: 'cursor' }),
      ]),
    );
    expect(
      document.paths['/api/me/orders/{id}/review'].post!.responses,
    ).toHaveProperty('409');
  });

  it('documents a required idempotency header and conflict response on creation', () => {
    const create = document.paths['/api/orders'].post!;
    expect(create.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'header',
          name: 'idempotency-key',
          required: true,
        }),
      ]),
    );
    expect(create.responses).toHaveProperty('201');
    expect(
      create.parameters?.filter(
        (parameter) =>
          'in' in parameter &&
          parameter.in === 'header' &&
          parameter.name.toLowerCase() === 'idempotency-key',
      ),
    ).toHaveLength(1);
    expect(create.responses).toHaveProperty('409');
    expect(create.security).toEqual([{ 'user-token': [] }]);
  });

  it('exposes availability, calendar and provider cancellation routes', () => {
    expect(
      document.paths['/api/providers/{id}/availability'].get,
    ).toBeDefined();
    expect(document.paths['/api/me/provider/calendar'].get).toBeDefined();
    expect(
      document.paths['/api/me/provider/calendar/time-off'].post,
    ).toBeDefined();
    expect(
      document.paths['/api/me/provider/calendar/time-off/{id}'].delete,
    ).toBeDefined();
    expect(
      document.paths['/api/me/provider/orders/{id}/cancel'].post,
    ).toBeDefined();
    expect(
      document.paths['/api/me/provider/orders/{id}/cancellation-request'].post,
    ).toBeDefined();
    expect(document.paths['/api/me/orders/{id}/review'].post).toBeDefined();
    expect(document.paths['/api/me/notifications'].get).toBeDefined();
    expect(
      document.paths['/api/me/provider/orders/{id}/evidence/{type}'].post,
    ).toBeDefined();
  });

  it('uses HTTP 200 for quotes, search and cancellation instead of implicit POST 201', () => {
    for (const path of [
      '/api/orders/quote',
      '/api/discovery/providers/search',
      '/api/me/orders/{id}/cancel',
    ]) {
      expect(document.paths[path].post!.responses).toHaveProperty('200');
      expect(document.paths[path].post!.responses).not.toHaveProperty('201');
    }
  });
});
