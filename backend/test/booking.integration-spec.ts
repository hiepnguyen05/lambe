import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { requireIsolatedTestDatabase } from './support/isolated-test-database';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { PROVIDER_LOCATION_STORE } from '../src/infrastructure/location/provider-location.store';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrdersService } from '../src/modules/orders/application/orders.service';
import { OrderEligibilityService } from '../src/modules/orders/application/order-eligibility.service';
import { OrderBookingService } from '../src/modules/orders/application/booking/order-booking.service';
import { OsrmRoutingService } from '../src/modules/orders/application/tracking/osrm-routing.service';
import { VoucherService } from '../src/modules/orders/application/pricing/voucher.service';
import { OrderWalletService } from '../src/modules/orders/application/payments/order-wallet.service';
import { OrderPaymentDisputeService } from '../src/modules/orders/application/payments/order-payment-dispute.service';
import { BookingCalendarService } from '../src/modules/orders/application/scheduling/booking-calendar.service';
import { BookingAvailabilityService } from '../src/modules/orders/application/scheduling/booking-availability.service';
import { OrderRescheduleService } from '../src/modules/orders/application/scheduling/order-reschedule.service';
import { CustomerOrdersController } from '../src/modules/orders/controllers/customer-orders.controller';
import { ProviderOrdersController } from '../src/modules/orders/controllers/provider-orders.controller';
import { BookingCalendarController } from '../src/modules/orders/controllers/booking-calendar.controller';
import { ProviderDiscoveryService } from '../src/modules/discovery/application/provider-discovery.service';
import { ScheduledProviderCandidatesService } from '../src/modules/discovery/application/scheduled-provider-candidates.service';
import { MaintenanceService } from '../src/infrastructure/maintenance/maintenance.service';
import { ConfigService } from '@nestjs/config';
import { OrderCancellationService } from '../src/modules/orders/application/cancellation/order-cancellation.service';
import { OrderReviewService } from '../src/modules/orders/application/reviews/order-review.service';
import { OrderEvidenceService } from '../src/modules/orders/application/evidence/order-evidence.service';
import { OrderNotificationsService } from '../src/modules/orders/application/notifications/order-notifications.service';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { OrderEvidenceController } from '../src/modules/orders/controllers/order-evidence.controller';
import { OrderNotificationsController } from '../src/modules/orders/controllers/order-notifications.controller';
import { ProviderReviewsController } from '../src/modules/orders/controllers/provider-reviews.controller';
import { MEDIA_STORAGE } from '../src/modules/upload/application/media-storage.port';
import { ChatService } from '../src/modules/chat/application/chat.service';
import { PushOutboxService } from '../src/modules/push/application/push-outbox.service';
import { ChatImageService } from '../src/modules/chat/application/chat-image.service';
import { ChatQueryService } from '../src/modules/chat/application/chat-query.service';
import { OrderChatService } from '../src/modules/chat/application/order-chat.service';
import { ChatModerationService } from '../src/modules/chat/application/chat-moderation.service';
import { ChatController } from '../src/modules/chat/controllers/chat.controller';
import { OrderAddOnsService } from '../src/modules/orders/application/add-ons/order-add-ons.service';
import { OrderAddOnsController } from '../src/modules/orders/controllers/order-add-ons.controller';
import { RematchController } from '../src/modules/rematch/controllers/rematch.controller';
import { RematchService } from '../src/modules/rematch/application/rematch.service';
import { MemberServingService } from '../src/modules/provider-members/application/booking/member-serving.service';
import { MemberDiscoveryService } from '../src/modules/discovery/application/member-discovery.service';
import { MEMBER_LOCATION_STORE } from '../src/infrastructure/location/member-location.store';
import { ObservabilityMetrics } from '../src/infrastructure/observability/observability-metrics.service';
import { ProviderServicesController } from '../src/modules/providers/controllers/provider-services.controller';
import { ProviderServiceChangesController } from '../src/modules/providers/controllers/provider-service-changes.controller';
import { ProviderServicesService } from '../src/modules/providers/application/services/provider-services.service';
import { ProviderServiceChangesService } from '../src/modules/providers/application/services/provider-service-changes.service';
import { ProviderServiceChangeDocumentsService } from '../src/modules/providers/application/services/provider-service-change-documents.service';
import { ProviderServiceChangeNotificationService } from '../src/modules/providers/application/services/provider-service-change-notification.service';

describe('booking HTTP + PostgreSQL concurrency', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const marker = randomUUID();
  const point = { latitude: 21.028, longitude: 105.834 };
  const locations = {
    getPosition: jest.fn().mockResolvedValue(point),
    findNearby: jest.fn().mockResolvedValue([]),
    isOnline: jest.fn().mockResolvedValue(true),
  };
  const scheduledAt = () => {
    const date = new Date(Date.now() + 2 * 86400000);
    date.setUTCHours(7, 0, 0, 0);
    return date.toISOString();
  };
  const scheduledBody = (f: Awaited<ReturnType<typeof fixture>>) => ({
    providerServiceId: f.service.id,
    customerAddressId: f.address.id,
    bookingType: 'SCHEDULED',
    scheduledAt: scheduledAt(),
  });

  beforeAll(async () => {
    requireIsolatedTestDatabase(process.env);
    const url = process.env.TEST_DATABASE_URL;
    prisma = new PrismaService({ datasources: { db: { url } } });
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'booking-integration-only-not-a-real-secret',
        }),
      ],
      controllers: [
        CustomerOrdersController,
        ProviderOrdersController,
        BookingCalendarController,
        OrderEvidenceController,
        OrderNotificationsController,
        ProviderReviewsController,
        ChatController,
        OrderAddOnsController,
        RematchController,
        ProviderServicesController,
        ProviderServiceChangesController,
      ],
      providers: [
        ObservabilityMetrics,
        OrdersService,
        ProviderServicesService,
        ProviderServiceChangesService,
        ProviderServiceChangeDocumentsService,
        {
          provide: ProviderServiceChangeNotificationService,
          useValue: {
            enqueue: jest.fn().mockResolvedValue(undefined),
            enqueueSuspension: jest.fn().mockResolvedValue(undefined),
          },
        },
        OrderEligibilityService,
        MemberServingService,
        MemberDiscoveryService,
        OrderBookingService,
        {
          provide: OsrmRoutingService,
          useValue: { getRoute: jest.fn().mockResolvedValue(null) },
        },
        VoucherService,
        ChatService,
        OrderChatService,
        {
          provide: PushOutboxService,
          useValue: { enqueue: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: ChatImageService, useValue: { send: jest.fn() } },
        ChatQueryService,
        ChatModerationService,
        OrderWalletService,
        OrderPaymentDisputeService,
        OrderCancellationService,
        OrderReviewService,
        OrderEvidenceService,
        OrderNotificationsService,
        {
          provide: RedisCacheService,
          useValue: {
            publishChatUpdate: jest.fn().mockResolvedValue(undefined),
            subscribeOrderNotifications: jest
              .fn()
              .mockResolvedValue(() => Promise.resolve()),
          },
        },
        BookingCalendarService,
        BookingAvailabilityService,
        OrderRescheduleService,
        OrderAddOnsService,
        AuditService,
        JwtAuthGuard,
        ProviderDiscoveryService,
        RematchService,
        ScheduledProviderCandidatesService,
        MaintenanceService,
        {
          provide: ConfigService,
          useValue: { get: (_: string, fallback: unknown) => fallback },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: PROVIDER_LOCATION_STORE, useValue: locations },
        {
          provide: MEMBER_LOCATION_STORE,
          useValue: {
            findNearbyMembers: jest.fn().mockResolvedValue([]),
            getMemberPosition: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MEDIA_STORAGE,
          useValue: {
            uploadPrivateImage: jest.fn().mockImplementation(() =>
              Promise.resolve({
                publicId: `test/${randomUUID()}`,
                format: 'png',
                deliveryType: 'authenticated',
              }),
            ),
            createPrivateDownloadUrl: jest
              .fn()
              .mockReturnValue('https://example.test/signed'),
            deleteImage: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useLogger(['error']);
    await app.init();
    await app.listen(0, '127.0.0.1');
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  async function signUserToken(user: { id: string; phone: string }) {
    const sessionId = randomUUID();
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return jwt.sign({
      sub: user.id,
      phone: user.phone,
      sessionId,
      purpose: 'access',
    });
  }

  async function fixture() {
    const suffix = randomUUID();
    const code = `TEST_${suffix.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const customer = await prisma.user.create({
      data: {
        phone: `customer-${suffix}`,
        fullName: marker,
        roles: { create: { role: 'CUSTOMER' } },
      },
    });
    const owner = await prisma.user.create({
      data: { phone: `provider-${suffix}`, fullName: marker },
    });
    const source = await prisma.providerApplication.create({
      data: {
        userId: owner.id,
        providerType: 'INDIVIDUAL',
        status: 'APPROVED',
      },
    });
    const provider = await prisma.providerProfile.create({
      data: {
        userId: owner.id,
        sourceApplicationId: source.id,
        providerType: 'INDIVIDUAL',
        displayName: marker,
        status: 'ACTIVE',
        setupCompletedAt: new Date(),
        serviceRadiusKm: 5,
        serviceAreaLatitude: point.latitude,
        serviceAreaLongitude: point.longitude,
        workingHours: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            startMinute: 0,
            endMinute: 1440,
          })),
        },
        wallet: { create: { balanceAmount: 1000000 } },
      },
    });
    const category = await prisma.serviceCategory.create({
      data: {
        code,
        name: marker,
        normalizedName: suffix,
        slug: suffix,
        status: 'ACTIVE',
      },
    });
    const catalog = await prisma.service.create({
      data: {
        categoryId: category.id,
        code,
        name: marker,
        normalizedName: suffix,
        slug: suffix,
        status: 'ACTIVE',
        minPriceAmount: 10000,
        maxPriceAmount: 1000000,
        defaultDurationMinutes: 60,
      },
    });
    const service = await prisma.providerService.create({
      data: {
        providerId: provider.id,
        serviceId: catalog.id,
        sourceApplicationId: source.id,
        priceAmount: 100000,
        durationMinutes: 60,
        status: 'ACTIVE',
      },
    });
    const address = await prisma.customerAddress.create({
      data: {
        userId: customer.id,
        label: 'Home',
        addressLine: 'Test address',
        ...point,
        isMapConfirmed: true,
      },
    });
    const token = await signUserToken(customer);
    const providerToken = await signUserToken(owner);
    return {
      customer,
      owner,
      provider,
      service,
      address,
      token,
      providerToken,
    };
  }

  const quoteTokensByKey = new Map<string, string>();
  function create(token: string, body: object, key = randomUUID()) {
    const send = async () => {
      const fields = body as Record<string, unknown>;
      const quoteBody = Object.fromEntries(
        [
          'providerServiceId',
          'customerAddressId',
          'inlineAddress',
          'bookingType',
          'scheduledAt',
          'voucherCode',
        ]
          .filter((field) => fields[field] !== undefined)
          .map((field) => [field, fields[field]]),
      );
      const quote = await request(app.getHttpServer())
        .post('/api/orders/quote')
        .auth(token, { type: 'bearer' })
        .send(quoteBody);
      if (quote.status !== 200) return quote;
      const freshToken = (quote.body as { data?: { quoteToken?: string } }).data
        ?.quoteToken;
      if (freshToken && !quoteTokensByKey.has(key))
        quoteTokensByKey.set(key, freshToken);
      return request(app.getHttpServer())
        .post('/api/orders')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({
          ...body,
          ...(quoteTokensByKey.has(key)
            ? { quoteToken: quoteTokensByKey.get(key) }
            : {}),
        });
    };
    return {
      expect: async (status: number) => {
        const response = await send();
        expect(response.status).toBe(status);
        return response;
      },
      then: (
        resolve: (response: Awaited<ReturnType<typeof send>>) => void,
        reject: (reason: unknown) => void,
      ) => send().then(resolve, reject),
    };
  }

  it('manages provider service availability without bypassing pending orders or changing accepted snapshots', async () => {
    const f = await fixture();
    const outsider = await fixture();
    const path = `/api/me/provider/services/${f.service.id}`;
    await request(app.getHttpServer())
      .get(path)
      .auth(outsider.providerToken, { type: 'bearer' })
      .expect(404);
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const orderId = (created.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .put(`${path}/availability`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({ active: false })
      .expect(400);
    await action(f.providerToken, orderId, 'accept').expect(200);
    const paused = await request(app.getHttpServer())
      .put(`${path}/availability`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({ active: false })
      .expect(200);
    expect((paused.body as { data: { status: string } }).data.status).toBe(
      'INACTIVE',
    );
    expect(
      await prisma.serviceOrder.findUnique({ where: { id: orderId } }),
    ).toMatchObject({ status: 'ACCEPTED', servicePriceAmount: 100000 });
    await prisma.service.update({
      where: { id: f.service.serviceId },
      data: { minPriceAmount: 200000 },
    });
    const blocked = await request(app.getHttpServer())
      .get(path)
      .auth(f.providerToken, { type: 'bearer' })
      .expect(200);
    expect(
      (blocked.body as { data: { blockerCode: string } }).data.blockerCode,
    ).toBe('PRICE_OUT_OF_RANGE');
    await request(app.getHttpServer())
      .put(`${path}/availability`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({ active: true })
      .expect(400);
    await prisma.providerService.update({
      where: { id: f.service.id },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .put(`${path}/availability`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({ active: true })
      .expect(403);
  });

  it('manages provider service-change drafts, private documents and resubmission with owned targets only', async () => {
    const f = await fixture();
    const outsider = await fixture();
    const path = '/api/me/provider/service-change-requests';
    const authorized = (
      method: 'get' | 'post' | 'patch' | 'delete',
      url: string,
      token = f.providerToken,
    ) =>
      request(app.getHttpServer())[method](url).auth(token, { type: 'bearer' });
    const body = {
      type: 'UPDATE_OFFERING',
      providerServiceId: f.service.id,
      proposedPriceAmount: 150000,
      proposedDurationMinutes: 75,
    };
    await authorized('post', path)
      .send({ ...body, proposedPriceAmount: 9999 })
      .expect(400);
    await authorized('post', path, outsider.providerToken)
      .send(body)
      .expect(404);
    const concurrent = await Promise.all([
      authorized('post', path).send(body),
      authorized('post', path).send(body),
    ]);
    expect(concurrent.map((r) => r.status).sort()).toEqual([201, 409]);
    const id = (
      concurrent.find((r) => r.status === 201)!.body as { data: { id: string } }
    ).data.id;
    await authorized('get', `${path}/${id}`, outsider.providerToken).expect(
      404,
    );
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0j8AAAAASUVORK5CYII=',
      'base64',
    );
    const upload = await authorized(
      'post',
      `${path}/${id}/documents/PROFESSIONAL_CERTIFICATE`,
    )
      .attach('file', png, 'certificate.png')
      .expect(201);
    const doc = (upload.body as { data: { id: string; publicId?: unknown } })
      .data;
    expect(doc).not.toHaveProperty('publicId');
    await authorized(
      'get',
      `${path}/${id}/documents/${doc.id}/access`,
      outsider.providerToken,
    ).expect(404);
    const access = await authorized(
      'get',
      `${path}/${id}/documents/${doc.id}/access`,
    ).expect(200);
    expect(access.headers['cache-control']).toBe('no-store');
    await authorized('post', `${path}/${id}/submit`).expect(200);
    await authorized('patch', `${path}/${id}`)
      .send({ proposedPriceAmount: 160000 })
      .expect(409);
    await authorized('post', `${path}/${id}/documents/PORTFOLIO`)
      .attach('file', png, 'work.png')
      .expect(409);
    await prisma.providerServiceChangeRequest.update({
      where: { id },
      data: {
        status: 'NEEDS_CHANGES',
        reviewNote: 'Bổ sung thông tin chuyên môn.',
      },
    });
    const edited = await authorized('patch', `${path}/${id}`)
      .send({
        proposedPriceAmount: 160000,
        proposedDurationMinutes: null,
        proposedDescription: null,
      })
      .expect(200);
    expect((edited.body as { data: unknown }).data).toMatchObject({
      status: 'DRAFT',
      reviewNote: null,
      proposedPriceAmount: 160000,
    });
    await authorized('delete', `${path}/${id}/documents/${doc.id}`).expect(200);
    await authorized('post', `${path}/${id}/submit`).expect(200);
    await authorized('post', `${path}/${id}/withdraw`).expect(200);
    await authorized('post', `${path}/${id}/submit`).expect(409);
    const category = await prisma.service.findUniqueOrThrow({
      where: { id: f.service.serviceId },
      select: { categoryId: true },
    });
    await authorized('post', path)
      .send({
        type: 'ADD_EXISTING_SERVICE',
        serviceId: outsider.service.serviceId,
        proposedPriceAmount: 120000,
      })
      .expect(201);
    await authorized('post', path)
      .send({
        type: 'PROPOSE_NEW_SERVICE',
        categoryId: category.categoryId,
        name: `New ${randomUUID()}`,
        proposedPriceAmount: 150000,
      })
      .expect(201);
    const page = await authorized(
      'get',
      `${path}?status=DRAFT&page=1&limit=1`,
    ).expect(200);
    expect(
      (page.body as { meta: { total: number; totalPages: number } }).meta,
    ).toMatchObject({ total: 2, totalPages: 2 });
    expect(
      await prisma.providerService.findUnique({ where: { id: f.service.id } }),
    ).toMatchObject({ priceAmount: 100000, durationMinutes: 60 });
  });

  it('supports consultation before booking without leaking another pair conversation', async () => {
    const f = await fixture();
    const stranger = await fixture();
    const clientMessageId = randomUUID();
    const first = await request(app.getHttpServer())
      .post('/api/me/conversations')
      .auth(f.token, { type: 'bearer' })
      .send({
        providerId: f.provider.id,
        kind: 'TEXT',
        text: 'Tư vấn kiểu tóc',
        clientMessageId,
      })
      .expect(200);
    const chatId = (first.body as { conversationId: string }).conversationId;
    expect(
      (first.body as { message: { sequence: number } }).message.sequence,
    ).toBe(1);

    await request(app.getHttpServer())
      .post('/api/me/conversations')
      .auth(f.token, { type: 'bearer' })
      .send({
        providerId: f.provider.id,
        kind: 'TEXT',
        text: 'Tư vấn kiểu tóc',
        clientMessageId,
      })
      .expect(200);
    expect(
      await prisma.chatMessage.count({ where: { conversationId: chatId } }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/me/conversations/${chatId}/messages`)
      .auth(stranger.token, { type: 'bearer' })
      .expect(404);

    const reply = await request(app.getHttpServer())
      .post(`/api/me/conversations/${chatId}/messages`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({
        kind: 'TEXT',
        text: 'Có thể tư vấn ạ',
        clientMessageId: randomUUID(),
      })
      .expect(200);
    expect(
      (reply.body as { message: { sequence: number } }).message.sequence,
    ).toBe(2);

    await request(app.getHttpServer())
      .put(`/api/me/conversations/${chatId}/block`)
      .auth(f.token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/me/conversations/${chatId}/messages`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({
        kind: 'TEXT',
        text: 'Tin bị chặn',
        clientMessageId: randomUUID(),
      })
      .expect(409);
  });

  it('links an order to the existing conversation without exposing booking PII in chat', async () => {
    const f = await fixture();
    const first = await request(app.getHttpServer())
      .post('/api/me/conversations')
      .auth(f.token, { type: 'bearer' })
      .send({
        providerId: f.provider.id,
        text: 'Mình muốn đặt lịch',
        clientMessageId: randomUUID(),
      })
      .expect(200);
    const chatId = (first.body as { conversationId: string }).conversationId;
    const card = await request(app.getHttpServer())
      .post(`/api/me/conversations/${chatId}/messages`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({
        kind: 'SERVICE_CARD',
        providerServiceId: f.service.id,
        clientMessageId: randomUUID(),
      })
      .expect(200);
    expect(
      (card.body as { message: { payload: { priceAmount: number } } }).message
        .payload.priceAmount,
    ).toBe(100000);
    const booked = await create(f.token, scheduledBody(f)).expect(201);
    const order = (
      booked.body as { data: { id: string; conversationId: string } }
    ).data;
    expect(order.conversationId).toBe(chatId);
    const messages = await request(app.getHttpServer())
      .get(`/api/me/conversations/${chatId}/messages`)
      .auth(f.providerToken, { type: 'bearer' })
      .expect(200);
    const event = (
      messages.body as {
        data: { kind: string; orderId: string; payload: object }[];
      }
    ).data.find((item) => item.kind === 'ORDER_EVENT');
    expect(event?.orderId).toBe(order.id);
    expect(JSON.stringify(event)).not.toContain('Test address');
    expect(JSON.stringify(event)).not.toContain(f.customer.phone);
  });

  it('serializes simultaneous chat messages and keeps read cursors monotonic', async () => {
    const f = await fixture();
    const first = await request(app.getHttpServer())
      .post('/api/me/conversations')
      .auth(f.token, { type: 'bearer' })
      .send({
        providerId: f.provider.id,
        text: 'Mở hội thoại',
        clientMessageId: randomUUID(),
      })
      .expect(200);
    const chatId = (first.body as { conversationId: string }).conversationId;
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        request(app.getHttpServer())
          .post(`/api/me/conversations/${chatId}/messages`)
          .auth(f.providerToken, { type: 'bearer' })
          .send({
            kind: 'TEXT',
            text: `Tin ${index}`,
            clientMessageId: randomUUID(),
          }),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const sequences = responses.map(
      (response) =>
        (response.body as { message: { sequence: number } }).message.sequence,
    );
    expect(new Set(sequences).size).toBe(12);
    expect(Math.min(...sequences)).toBe(2);
    expect(Math.max(...sequences)).toBe(13);

    await request(app.getHttpServer())
      .patch(`/api/me/conversations/${chatId}/read`)
      .auth(f.token, { type: 'bearer' })
      .send({ lastReadSequence: 13 })
      .expect(200);
    const stale = await request(app.getHttpServer())
      .patch(`/api/me/conversations/${chatId}/read`)
      .auth(f.token, { type: 'bearer' })
      .send({ lastReadSequence: 5 })
      .expect(200);
    expect((stale.body as { lastReadSequence: number }).lastReadSequence).toBe(
      13,
    );
  });
  function action(
    token: string,
    id: string,
    command: string,
    body: object = {},
  ) {
    return request(app.getHttpServer())
      .post(`/api/me/provider/orders/${id}/${command}`)
      .auth(token, { type: 'bearer' })
      .send(body);
  }

  function arrive(
    token: string,
    id: string,
    overrides: Record<string, unknown> = {},
  ) {
    return action(token, id, 'arrive', {
      ...point,
      accuracyMeters: 15,
      capturedAt: new Date().toISOString(),
      ...overrides,
    });
  }

  function uploadEvidence(token: string, orderId: string, type: string) {
    return request(app.getHttpServer())
      .post(`/api/me/provider/orders/${orderId}/evidence/${type}`)
      .auth(token, { type: 'bearer' })
      .query({ latitude: point.latitude, longitude: point.longitude })
      .attach(
        'file',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'photo.png',
      );
  }

  it('requires authentication and an idempotency key', async () => {
    const f = await fixture();
    await request(app.getHttpServer())
      .post('/api/orders')
      .send(scheduledBody(f))
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/orders')
      .auth(f.token, { type: 'bearer' })
      .send(scheduledBody(f))
      .expect(400);
    await create(f.token, {
      ...scheduledBody(f),
      scheduledAt: '2026-10-20T14:00:00',
    }).expect(400);
    await create(f.token, { ...scheduledBody(f), totalAmount: 1 }).expect(400);
  });

  it('rejects a changed price after quoting and a tampered quote token', async () => {
    const f = await fixture();
    const body = scheduledBody(f);
    const quote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send(body)
      .expect(200);
    const quoteToken = (quote.body as { data: { quoteToken: string } }).data
      .quoteToken;
    await request(app.getHttpServer())
      .post('/api/orders')
      .auth(f.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, quoteToken: `${quoteToken}x` })
      .expect(409);
    await prisma.providerService.update({
      where: { id: f.service.id },
      data: { priceAmount: f.service.priceAmount + 10000 },
    });
    const changed = await request(app.getHttpServer())
      .post('/api/orders')
      .auth(f.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, quoteToken })
      .expect(409);
    expect((changed.body as { code?: string }).code).toBe('QUOTE_CHANGED');
  });

  it('rejects a quote when the saved address changes before booking', async () => {
    const f = await fixture();
    const body = scheduledBody(f);
    const quote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send(body)
      .expect(200);
    const quoteToken = (quote.body as { data: { quoteToken: string } }).data
      .quoteToken;
    await prisma.customerAddress.update({
      where: { id: f.address.id },
      data: { addressLine: 'Different destination' },
    });
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .auth(f.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, quoteToken })
      .expect(409);
    expect((response.body as { code?: string }).code).toBe('QUOTE_CHANGED');
    expect(
      await prisma.serviceOrder.count({ where: { customerId: f.customer.id } }),
    ).toBe(0);
  });

  it('changes an accepted scheduled order only after provider approval', async () => {
    const f = await fixture();
    const body = scheduledBody(f);
    const created = await create(f.token, body).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    const proposedStartAt = new Date(
      Date.parse(body.scheduledAt) + 2 * 60 * 60 * 1000,
    ).toISOString();
    const firstProposal = await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/reschedule`)
      .auth(f.token, { type: 'bearer' })
      .send({ scheduledAt: proposedStartAt })
      .expect(200);
    const before = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id },
    });
    expect(before.expectedStartAt.toISOString()).toBe(body.scheduledAt);
    await request(app.getHttpServer())
      .post(`/api/me/provider/orders/${id}/reschedule/decision`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({ approve: false })
      .expect(200);
    const replacement = await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/reschedule`)
      .auth(f.token, { type: 'bearer' })
      .send({ scheduledAt: proposedStartAt })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/me/provider/orders/${id}/reschedule/decision`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({
        requestId: (firstProposal.body as { data: { id: string } }).data.id,
        approve: true,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/me/provider/orders/${id}/reschedule/decision`)
      .auth(f.providerToken, { type: 'bearer' })
      .send({
        requestId: (replacement.body as { data: { id: string } }).data.id,
        approve: true,
      })
      .expect(200);
    const after = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id },
      include: { calendarBlock: true },
    });
    expect(after.expectedStartAt.toISOString()).toBe(proposedStartAt);
    expect(after.calendarBlock?.startAt.toISOString()).toBe(proposedStartAt);
  });

  it('paginates orders with an owner-scoped cursor', async () => {
    const f = await fixture();
    const other = await fixture();
    const first = await create(f.token, scheduledBody(f)).expect(201);
    const firstId = (first.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .post(`/api/me/orders/${firstId}/cancel`)
      .auth(f.token, { type: 'bearer' })
      .send({ reason: 'Đổi lịch thử nghiệm.' })
      .expect(200);
    const second = await create(f.token, scheduledBody(f)).expect(201);
    const secondId = (second.body as { data: { id: string } }).data.id;
    const list = (cursor?: string) =>
      request(app.getHttpServer())
        .get('/api/me/orders')
        .auth(f.token, { type: 'bearer' })
        .query({ limit: 1, ...(cursor ? { cursor } : {}) });
    const page1 = await list().expect(200);
    const page1Body = page1.body as {
      data: { id: string }[];
      meta: { nextCursor: string | null };
    };
    expect(page1Body.data).toHaveLength(1);
    expect(page1Body.meta.nextCursor).toBe(page1Body.data[0].id);
    const page2 = await list(page1Body.meta.nextCursor!).expect(200);
    const page2Body = page2.body as {
      data: { id: string }[];
      meta: { nextCursor: string | null };
    };
    expect(new Set([page1Body.data[0].id, page2Body.data[0].id])).toEqual(
      new Set([firstId, secondId]),
    );
    expect(page2Body.meta.nextCursor).toBeNull();
    const otherOrder = await create(other.token, scheduledBody(other)).expect(
      201,
    );
    const otherId = (otherOrder.body as { data: { id: string } }).data.id;
    await list(otherId).expect(400);
  });

  it('allows only one of 40 concurrent customers to reserve the same slot', async () => {
    const f = await fixture();
    const identities = await Promise.all(
      Array.from({ length: 40 }, async () => {
        const user = await prisma.user.create({
          data: { phone: randomUUID(), fullName: marker },
        });
        const address = await prisma.customerAddress.create({
          data: {
            userId: user.id,
            label: 'Home',
            addressLine: 'Test',
            ...point,
          },
        });
        return {
          token: await signUserToken(user),
          addressId: address.id,
        };
      }),
    );
    const quoted: { token: string; body: object; quoteToken: string }[] = [];
    const slot = scheduledBody(f);
    for (const identity of identities) {
      const body = { ...slot, customerAddressId: identity.addressId };
      const response = await request(app.getHttpServer())
        .post('/api/orders/quote')
        .auth(identity.token, { type: 'bearer' })
        .send(body)
        .expect(200);
      quoted.push({
        token: identity.token,
        body,
        quoteToken: (response.body as { data: { quoteToken: string } }).data
          .quoteToken,
      });
    }
    const started = performance.now();
    const results = await Promise.all(
      quoted.map((item) =>
        request(app.getHttpServer())
          .post('/api/orders')
          .auth(item.token, { type: 'bearer' })
          .set('Idempotency-Key', randomUUID())
          .send({ ...item.body, quoteToken: item.quoteToken }),
      ),
    );
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(39);
    expect(
      await prisma.providerCalendarBlock.count({
        where: { providerId: f.provider.id, active: true },
      }),
    ).toBe(1);
    process.stdout.write(
      `booking contention: 40 HTTP requests in ${Math.round(performance.now() - started)} ms\n`,
    );
  });

  it('replays duplicate requests and refuses the same key with a different payload', async () => {
    const f = await fixture();
    const key = randomUUID();
    const body = scheduledBody(f);
    const quote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send(body)
      .expect(200);
    const quoteToken = (quote.body as { data: { quoteToken: string } }).data
      .quoteToken;
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app.getHttpServer())
          .post('/api/orders')
          .auth(f.token, { type: 'bearer' })
          .set('Idempotency-Key', key)
          .send({ ...body, quoteToken }),
      ),
    );
    expect(responses.every((result) => result.status === 201)).toBe(true);
    const ids = responses.map(
      (result) => (result.body as { data: { id: string } }).data.id,
    );
    expect(new Set(ids).size).toBe(1);
    await request(app.getHttpServer())
      .post('/api/orders')
      .auth(f.token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ ...body, quoteToken, customerNote: 'different' })
      .expect(409);
    expect(
      await prisma.serviceOrder.count({ where: { customerId: f.customer.id } }),
    ).toBe(1);
  });

  it('retains snapshots, holds funds once, and releases them on provider cancellation', async () => {
    const f = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await prisma.customerAddress.delete({ where: { id: f.address.id } });
    await prisma.providerService.update({
      where: { id: f.service.id },
      data: { priceAmount: 200000, durationMinutes: 120 },
    });
    const results = await Promise.all([
      action(f.providerToken, id, 'accept'),
      action(f.providerToken, id, 'accept'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.walletHold.count({ where: { orderId: id } })).toBe(1);
    expect(
      await prisma.providerWallet.findUnique({
        where: { providerId: f.provider.id },
      }),
    ).toMatchObject({ heldAmount: 10000, balanceAmount: 1000000 });
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ servicePriceAmount: 100000, durationMinutes: 60 });
    await action(f.providerToken, id, 'en-route').expect(409);
    await action(f.providerToken, id, 'cancel', {
      reason: 'Cannot serve',
    }).expect(200);
    expect(
      await prisma.providerCalendarBlock.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ active: false });
    expect(
      await prisma.providerWallet.findUnique({
        where: { providerId: f.provider.id },
      }),
    ).toMatchObject({ heldAmount: 0, balanceAmount: 1000000 });
  });

  it('allows ASAP before a distant scheduled appointment and completes cash settlement once', async () => {
    const f = await fixture();
    const scheduled = await create(f.token, scheduledBody(f)).expect(201);
    await action(
      f.providerToken,
      (scheduled.body as { data: { id: string } }).data.id,
      'accept',
    ).expect(200);
    const immediate = await create(f.token, {
      ...scheduledBody(f),
      bookingType: 'ASAP',
      scheduledAt: undefined,
    }).expect(201);
    const id = (immediate.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await prisma.orderEvidence.create({
      data: {
        orderId: id,
        type: 'ARRIVAL',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
        latitude: point.latitude,
        longitude: point.longitude,
      },
    });
    await arrive(f.providerToken, id).expect(200);
    await prisma.orderEvidence.create({
      data: {
        orderId: id,
        type: 'BEFORE_WORK',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
      },
    });
    await action(f.providerToken, id, 'start').expect(200);
    await prisma.orderEvidence.create({
      data: {
        orderId: id,
        type: 'AFTER_WORK',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
      },
    });
    await action(f.providerToken, id, 'complete', {
      cashReceived: false,
    }).expect(400);
    const results = await Promise.all([
      action(f.providerToken, id, 'complete', { cashReceived: true }),
      action(f.providerToken, id, 'complete', { cashReceived: true }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.walletTransaction.count({
        where: { orderId: id, type: 'COMMISSION' },
      }),
    ).toBe(1);
  });

  it('adds a customer-approved service once and settles the extended wallet hold', async () => {
    const f = await fixture();
    const catalogId = randomUUID();
    const catalog = await prisma.service.create({
      data: {
        categoryId: (
          await prisma.service.findUniqueOrThrow({
            where: { id: f.service.serviceId },
          })
        ).categoryId,
        code: `ADDON_${catalogId.replace(/-/g, '').slice(0, 20).toUpperCase()}`,
        name: 'Nhuộm tóc',
        normalizedName: catalogId,
        slug: catalogId,
        status: 'ACTIVE',
        minPriceAmount: 10000,
        maxPriceAmount: 1000000,
        defaultDurationMinutes: 30,
      },
    });
    const extra = await prisma.providerService.create({
      data: {
        providerId: f.provider.id,
        serviceId: catalog.id,
        sourceApplicationId: f.provider.sourceApplicationId,
        priceAmount: 80000,
        durationMinutes: 30,
        status: 'ACTIVE',
      },
    });
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const orderId = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, orderId, 'accept').expect(200);
    await action(f.providerToken, orderId, 'en-route').expect(200);
    await prisma.orderEvidence.create({
      data: {
        orderId,
        type: 'ARRIVAL',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
        latitude: point.latitude,
        longitude: point.longitude,
      },
    });
    await arrive(f.providerToken, orderId).expect(200);
    await prisma.orderEvidence.create({
      data: {
        orderId,
        type: 'BEFORE_WORK',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
      },
    });
    await action(f.providerToken, orderId, 'start').expect(200);

    const key = randomUUID();
    const propose = () =>
      request(app.getHttpServer())
        .post(`/api/me/provider/orders/${orderId}/add-ons`)
        .auth(f.providerToken, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({ providerServiceId: extra.id, note: 'Khách muốn thêm màu nâu' });
    const proposal = await propose().expect(201);
    const addOnId = (proposal.body as { data: { id: string } }).data.id;
    await propose().expect(201);
    expect(await prisma.orderAddOn.count({ where: { orderId } })).toBe(1);
    await action(f.providerToken, orderId, 'complete', {
      cashReceived: true,
    }).expect(409);

    const stranger = await fixture();
    await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/add-ons/${addOnId}/decision`)
      .auth(stranger.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(404);
    await prisma.providerService.update({
      where: { id: extra.id },
      data: { priceAmount: 90000 },
    });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/add-ons/${addOnId}/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(409);
    await prisma.providerService.update({
      where: { id: extra.id },
      data: { priceAmount: 80000 },
    });
    await prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 17000 },
    });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/add-ons/${addOnId}/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(409);
    expect(
      (await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } }))
        .totalAmount,
    ).toBe(100000);
    await prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 1000000 },
    });
    const approved = await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/add-ons/${addOnId}/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(200);
    expect(
      (
        approved.body as {
          data: { addOn: { status: string }; order: { totalAmount: number } };
        }
      ).data,
    ).toMatchObject({
      addOn: { status: 'ACCEPTED' },
      order: { totalAmount: 180000 },
    });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/add-ons/${addOnId}/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(409);
    expect(
      await prisma.walletHold.findUnique({ where: { orderId } }),
    ).toMatchObject({ amount: 18000, status: 'ACTIVE' });
    expect(
      await prisma.walletTransaction.count({
        where: { orderId, type: 'HOLD' },
      }),
    ).toBe(2);
    await prisma.orderEvidence.create({
      data: {
        orderId,
        type: 'AFTER_WORK',
        publicId: `test/${randomUUID()}`,
        fileFormat: 'jpg',
      },
    });
    await action(f.providerToken, orderId, 'complete', {
      cashReceived: true,
    }).expect(200);
    expect(
      await prisma.walletHold.findUnique({ where: { orderId } }),
    ).toMatchObject({ amount: 18000, status: 'CAPTURED' });
  });

  it('releases expired holds even if the expiry worker has not run yet', async () => {
    const f = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await prisma.serviceOrder.update({
      where: { id },
      data: { providerResponseDeadlineAt: new Date(Date.now() - 1000) },
    });
    await prisma.providerCalendarBlock.update({
      where: { orderId: id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });
    await create(f.token, scheduledBody(f)).expect(201);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'EXPIRED' });
    expect(
      await prisma.providerCalendarBlock.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ active: false });
  });

  it('denies other owners, enforces radius, supports time off and suggests later slots', async () => {
    const f = await fixture();
    const stranger = await fixture();
    await create(stranger.token, scheduledBody(f)).expect(404);
    const day = scheduledAt().slice(0, 10);
    const from = scheduledAt();
    const to = new Date(Date.parse(from) + 3600000).toISOString();
    const pause = await request(app.getHttpServer())
      .post('/api/me/provider/calendar/time-off')
      .auth(f.providerToken, { type: 'bearer' })
      .send({ from, to, reason: 'Break' })
      .expect(201);
    const pauseId = (pause.body as { data: { id: string } }).data.id;
    const unavailable = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send(scheduledBody(f))
      .expect(200);
    expect(
      (unavailable.body as { data: { available: boolean } }).data.available,
    ).toBe(false);
    const slots = await request(app.getHttpServer())
      .get(`/api/providers/${f.provider.id}/availability`)
      .auth(f.token, { type: 'bearer' })
      .query({
        providerServiceId: f.service.id,
        customerAddressId: f.address.id,
        date: day,
      })
      .expect(200);
    expect(
      (slots.body as { data: { slots: unknown[] } }).data.slots.length,
    ).toBeGreaterThan(0);
    await request(app.getHttpServer())
      .delete(`/api/me/provider/calendar/time-off/${pauseId}`)
      .auth(stranger.providerToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/me/provider/calendar/time-off/${pauseId}`)
      .auth(f.providerToken, { type: 'bearer' })
      .expect(200);
    await prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { serviceAreaLatitude: point.latitude + 0.1 },
    });
    await create(f.token, scheduledBody(f)).expect(409);
  });

  it('uses the PostgreSQL exclusion constraint even when application locking is bypassed', async () => {
    const f = await fixture();
    const startAt = new Date(scheduledAt());
    const endAt = new Date(startAt.getTime() + 3600000);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        prisma.providerCalendarBlock.create({
          data: {
            providerId: f.provider.id,
            startAt,
            endAt,
            reason: 'DB contention test',
          },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(9);
  });

  it('does not expose an unaccepted address on provider cancellation or permit other owners to mutate orders', async () => {
    const f = await fixture();
    const stranger = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(stranger.providerToken, id, 'reject', {
      reason: 'Not mine',
    }).expect(404);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/cancel`)
      .auth(stranger.token, { type: 'bearer' })
      .send({ reason: 'Not mine' })
      .expect(404);
    const response = await action(f.providerToken, id, 'cancel', {
      reason: 'Cannot serve',
    }).expect(200);
    expect((response.body as { data: object }).data).toMatchObject({
      status: 'CANCELLED',
      addressLine: null,
      addressLatitude: null,
      contactPhone: null,
      customer: { phone: null },
    });
  });

  it('serializes accept versus customer cancellation without orphaned holds', async () => {
    const f = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    const [accepted, cancelled] = await Promise.all([
      action(f.providerToken, id, 'accept'),
      request(app.getHttpServer())
        .post(`/api/me/orders/${id}/cancel`)
        .auth(f.token, { type: 'bearer' })
        .send({ reason: 'Changed plans' }),
    ]);
    expect([200, 409]).toContain(accepted.status);
    expect(cancelled.status).toBe(200);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'CANCELLED' });
    expect(
      await prisma.providerWallet.findUnique({
        where: { providerId: f.provider.id },
      }),
    ).toMatchObject({ heldAmount: 0, balanceAmount: 1000000 });
    expect(
      await prisma.walletHold.count({
        where: { orderId: id, status: 'ACTIVE' },
      }),
    ).toBe(0);
    expect(
      await prisma.providerCalendarBlock.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ active: false });
  });

  it('protects buffers between neighbouring bookings and refuses new bookings while a previous job overruns', async () => {
    const f = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    const tooClose = new Date(
      Date.parse(scheduledAt()) - 60 * 60000,
    ).toISOString();
    const unavailable = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send({ ...scheduledBody(f), scheduledAt: tooClose })
      .expect(200);
    expect(
      (unavailable.body as { data: { available: boolean } }).data.available,
    ).toBe(false);
    const now = new Date();
    await prisma.serviceOrder.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(now.getTime() - 90 * 60000),
      },
    });
    await prisma.providerCalendarBlock.update({
      where: { orderId: id },
      data: {
        startAt: new Date(now.getTime() - 90 * 60000),
        endAt: new Date(now.getTime() - 30 * 60000),
      },
    });
    const quote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(f.token, { type: 'bearer' })
      .send({
        providerServiceId: f.service.id,
        customerAddressId: f.address.id,
        bookingType: 'ASAP',
      })
      .expect(200);
    expect((quote.body as { data: object }).data).toMatchObject({
      available: false,
      reason: 'PROVIDER_BUSY',
    });
    const blocks = await app
      .get(BookingCalendarService)
      .read([f.provider.id], now, new Date(now.getTime() + 86400000));
    expect(blocks.get(f.provider.id)?.[0]).toMatchObject({
      estimated: true,
      executing: true,
    });
    expect(blocks.get(f.provider.id)![0].endAt.getTime()).toBeGreaterThan(
      now.getTime(),
    );
  });

  it('rechecks wallet funds at acceptance and keeps a failed acceptance atomic', async () => {
    const f = await fixture();
    const created = await create(f.token, scheduledBody(f)).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 0 },
    });
    await action(f.providerToken, id, 'accept').expect(400);
    expect(await prisma.walletHold.count({ where: { orderId: id } })).toBe(0);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'PENDING_PROVIDER' });
    expect(
      await prisma.providerCalendarBlock.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ active: true });
  });

  it('scheduled discovery works offline with each provider radius and shared calendar checks', async () => {
    const f = await fixture();
    const result = await app
      .get(ProviderDiscoveryService)
      .search(f.customer.id, {
        serviceId: f.service.serviceId,
        customerAddressId: f.address.id,
        bookingType: 'SCHEDULED',
        scheduledAt: scheduledAt(),
      });
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: f.provider.id, available: true }),
      ]),
    );
    await create(f.token, scheduledBody(f)).expect(201);
    const second = await app
      .get(ProviderDiscoveryService)
      .search(f.customer.id, {
        serviceId: f.service.serviceId,
        customerAddressId: f.address.id,
        bookingType: 'SCHEDULED',
        scheduledAt: scheduledAt(),
      });
    expect(second.data[0]).toMatchObject({ available: false });
    expect(second.data[0].suggestedSlots.length).toBeGreaterThan(0);
  });

  it('accepts an address entered only for this order and snapshots recipient details', async () => {
    const f = await fixture();
    const inlineAddress = {
      label: 'Tại nhà bạn',
      addressLine: '123 Test Street, Hanoi',
      ...point,
      note: 'Tầng 2',
    };
    const body = {
      providerServiceId: f.service.id,
      bookingType: 'SCHEDULED',
      scheduledAt: scheduledAt(),
      inlineAddress,
      contactName: 'Nguyen Van A',
      contactPhone: '0912345678',
    };
    await create(f.token, { ...body, customerAddressId: f.address.id }).expect(
      400,
    );
    const created = await create(f.token, body).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    expect(
      await prisma.customerAddress.count({ where: { userId: f.customer.id } }),
    ).toBe(1);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({
      customerAddressId: null,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      addressLine: inlineAddress.addressLine,
    });
    await action(f.providerToken, id, 'accept').expect(200);
  });

  it('allows arrival without a photo but rejects stale and distant GPS', async () => {
    const f = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await action(f.providerToken, id, 'arrive').expect(400);
    await arrive(f.providerToken, id, { accuracyMeters: 101 }).expect(400);
    await arrive(f.providerToken, id, {
      capturedAt: new Date(Date.now() - 31_000).toISOString(),
    }).expect(409);
    await arrive(f.providerToken, id, {
      latitude: point.latitude + 0.1,
    }).expect(409);
    await arrive(f.providerToken, id).expect(200);
    const order = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id },
    });
    expect(order.arrivalDistanceMeters).toBe(0);
    expect(order.arrivalAccuracyMeters).toBe(15);
    expect(await prisma.orderEvidence.count({ where: { orderId: id } })).toBe(
      0,
    );
    await action(f.providerToken, id, 'start').expect(409);
  });

  it('requires private stage evidence, protects access, and allows one completed-order review', async () => {
    const f = await fixture();
    const stranger = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await arrive(f.providerToken, id, {
      latitude: point.latitude + 0.1,
    }).expect(409);
    await uploadEvidence(stranger.providerToken, id, 'ARRIVAL').expect(404);
    await request(app.getHttpServer())
      .post(`/api/me/provider/orders/${id}/evidence/ARRIVAL`)
      .auth(f.providerToken, { type: 'bearer' })
      .query({ latitude: point.latitude + 0.1, longitude: point.longitude })
      .attach(
        'file',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        'photo.png',
      )
      .expect(409);
    const arrival = await uploadEvidence(f.providerToken, id, 'ARRIVAL').expect(
      201,
    );
    const evidenceId = (arrival.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .get(`/api/orders/${id}/evidence/${evidenceId}`)
      .auth(stranger.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/orders/${id}/evidence/${evidenceId}`)
      .auth(f.token, { type: 'bearer' })
      .expect(200);
    await arrive(f.providerToken, id).expect(200);
    await action(f.providerToken, id, 'start').expect(409);
    await uploadEvidence(f.providerToken, id, 'BEFORE_WORK').expect(201);
    await action(f.providerToken, id, 'start').expect(200);
    await action(f.providerToken, id, 'complete', {
      cashReceived: true,
    }).expect(409);
    await uploadEvidence(f.providerToken, id, 'AFTER_WORK').expect(201);
    await action(f.providerToken, id, 'complete', {
      cashReceived: true,
    }).expect(200);
    const reviewPath = `/api/me/orders/${id}/review`;
    await request(app.getHttpServer())
      .post(reviewPath)
      .auth(stranger.token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(404);
    await request(app.getHttpServer())
      .post(reviewPath)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 6 })
      .expect(400);
    await request(app.getHttpServer())
      .post(reviewPath)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 5, comment: 'Rất tốt' })
      .expect(201);
    await request(app.getHttpServer())
      .post(reviewPath)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(409);
    const publicReviews = await request(app.getHttpServer())
      .get(`/api/providers/${f.provider.id}/reviews`)
      .expect(200);
    expect((publicReviews.body as { data: { count: number } }).data.count).toBe(
      1,
    );
    const inbox = await request(app.getHttpServer())
      .get('/api/me/notifications')
      .auth(f.token, { type: 'bearer' })
      .expect(200);
    expect(
      (inbox.body as { data: { event: string }[] }).data.map(
        (item) => item.event,
      ),
    ).toContain('ORDER_COMPLETED');
  });

  it('keeps commission held during a cash dispute and captures it only after staff confirms payment', async () => {
    const f = await fixture();
    const outsider = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await arrive(f.providerToken, id).expect(200);
    await uploadEvidence(f.providerToken, id, 'BEFORE_WORK').expect(201);
    await action(f.providerToken, id, 'start').expect(200);
    await action(f.providerToken, id, 'payment-dispute', {
      reason: 'Khách chưa thanh toán đủ tiền mặt.',
    }).expect(409);
    await uploadEvidence(f.providerToken, id, 'AFTER_WORK').expect(201);
    await action(outsider.providerToken, id, 'payment-dispute', {
      reason: 'Khách chưa thanh toán đủ tiền mặt.',
    }).expect(404);
    await action(f.providerToken, id, 'payment-dispute', {
      reason: 'Khách chưa thanh toán đủ tiền mặt.',
    }).expect(200);
    await action(f.providerToken, id, 'payment-dispute', {
      reason: 'Khách chưa thanh toán đủ tiền mặt.',
    }).expect(409);

    const hold = await prisma.walletHold.findUniqueOrThrow({
      where: { orderId: id },
    });
    const before = await prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    expect(hold.status).toBe('ACTIVE');
    expect(before.heldAmount).toBe(hold.amount);
    expect(
      await prisma.providerCalendarBlock.findFirst({
        where: { orderId: id, active: true },
      }),
    ).toBeNull();
    const customerView = await request(app.getHttpServer())
      .get(`/api/me/orders/${id}`)
      .auth(f.token, { type: 'bearer' })
      .expect(200);
    expect((customerView.body as { data: unknown }).data).toMatchObject({
      status: 'PAYMENT_DISPUTE',
      paymentDisputeReason: 'Khách chưa thanh toán đủ tiền mặt.',
    });
    expect((customerView.body as { data: unknown }).data).not.toHaveProperty(
      'commissionHold',
    );
    const providerView = await request(app.getHttpServer())
      .get(`/api/me/provider/orders/${id}`)
      .auth(f.providerToken, { type: 'bearer' })
      .expect(200);
    expect(
      (providerView.body as { data: { commissionHold: unknown } }).data
        .commissionHold,
    ).toEqual({ amount: hold.amount, status: 'ACTIVE' });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/review`)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(409);

    const disputes = app.get(OrderPaymentDisputeService);
    await disputes.decide(
      randomUUID(),
      id,
      {
        decision: 'CONFIRM_UNPAID',
        note: 'Đã đối chiếu và khách chưa thanh toán.',
      },
      {},
    );
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ status: 'ACTIVE' });
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'DISPUTED' });
    const disputeView = await request(app.getHttpServer())
      .get(`/api/me/orders/${id}`)
      .auth(f.token, { type: 'bearer' })
      .expect(200);
    expect(
      (disputeView.body as { data: Record<string, unknown> }).data,
    ).not.toHaveProperty('paymentDisputeDecisionNote');
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/review`)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(409);
    await disputes.decide(
      randomUUID(),
      id,
      {
        decision: 'CONFIRM_PAID',
        note: 'Khách đã thanh toán sau khi hỗ trợ.',
      },
      {},
    );
    const after = await prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    expect(after.heldAmount).toBe(0);
    expect(after.balanceAmount).toBe(before.balanceAmount - hold.amount);
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ status: 'CAPTURED' });
    const settledView = await request(app.getHttpServer())
      .get(`/api/me/provider/orders/${id}`)
      .auth(f.providerToken, { type: 'bearer' })
      .expect(200);
    expect(
      (settledView.body as { data: { commissionHold: unknown } }).data
        .commissionHold,
    ).toEqual({ amount: hold.amount, status: 'CAPTURED' });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/review`)
      .auth(f.token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(201);
    await expect(
      disputes.decide(
        randomUUID(),
        id,
        {
          decision: 'CONFIRM_PAID',
          note: 'Thử xác nhận lần nữa.',
        },
        {},
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('escalates a disputed provider cancellation without releasing the hold', async () => {
    const f = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await uploadEvidence(f.providerToken, id, 'INCIDENT').expect(201);
    await action(f.providerToken, id, 'cancellation-request', {
      reason: 'TRANSPORT_ISSUE',
      detail: 'Xe bị hỏng trên đường di chuyển.',
    }).expect(200);
    await arrive(f.providerToken, id).expect(409);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/cancellation/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: false, note: 'Cần bộ phận hỗ trợ xem xét.' })
      .expect(200);
    expect(
      await prisma.orderCancellationRequest.findUnique({
        where: { orderId: id },
      }),
    ).toMatchObject({ status: 'SUPPORT_REVIEW' });
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ status: 'ACTIVE' });
  });

  it('requires two spaced contact attempts before customer-unreachable cancellation', async () => {
    const f = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await uploadEvidence(f.providerToken, id, 'ARRIVAL').expect(201);
    await arrive(f.providerToken, id).expect(200);
    const cancellation = {
      reason: 'CUSTOMER_UNREACHABLE',
      detail: 'Khách không nghe điện thoại ở địa chỉ hẹn.',
    };
    await action(
      f.providerToken,
      id,
      'cancellation-request',
      cancellation,
    ).expect(409);
    const first = await action(f.providerToken, id, 'contact-attempt').expect(
      200,
    );
    await prisma.orderContactAttempt.update({
      where: { id: (first.body as { data: { id: string } }).data.id },
      data: { attemptedAt: new Date(Date.now() - 6 * 60_000) },
    });
    await action(f.providerToken, id, 'contact-attempt').expect(200);
    await action(
      f.providerToken,
      id,
      'cancellation-request',
      cancellation,
    ).expect(200);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/cancellation/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: true })
      .expect(200);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'CANCELLED' });
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ status: 'RELEASED' });
  });

  it('lets support approve an escalated cancellation atomically', async () => {
    const f = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await uploadEvidence(f.providerToken, id, 'INCIDENT').expect(201);
    await action(f.providerToken, id, 'cancellation-request', {
      reason: 'TRANSPORT_ISSUE',
      detail: 'Xe bị hỏng trên đường di chuyển.',
    }).expect(200);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${id}/cancellation/decision`)
      .auth(f.token, { type: 'bearer' })
      .send({ approve: false })
      .expect(200);
    const internal = await prisma.internalAccount.create({
      data: {
        username: randomUUID(),
        normalizedUsername: randomUUID(),
        fullName: 'Support Test',
        status: 'ACTIVE',
      },
    });
    await app
      .get(OrderCancellationService)
      .supportDecide(internal.id, id, { approve: true }, {});
    expect(
      await prisma.serviceOrder.findUnique({ where: { id } }),
    ).toMatchObject({ status: 'CANCELLED' });
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ status: 'RELEASED' });
    expect(
      await prisma.providerCalendarBlock.findUnique({ where: { orderId: id } }),
    ).toMatchObject({ active: false });
  });

  it('escalates unanswered cancellation requests and notifies both parties', async () => {
    const f = await fixture();
    const created = await create(f.token, {
      providerServiceId: f.service.id,
      customerAddressId: f.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const id = (created.body as { data: { id: string } }).data.id;
    await action(f.providerToken, id, 'accept').expect(200);
    await action(f.providerToken, id, 'en-route').expect(200);
    await uploadEvidence(f.providerToken, id, 'INCIDENT').expect(201);
    await action(f.providerToken, id, 'cancellation-request', {
      reason: 'TRANSPORT_ISSUE',
      detail: 'Xe bị hỏng trên đường di chuyển.',
    }).expect(200);
    await prisma.orderCancellationRequest.update({
      where: { orderId: id },
      data: { requestedAt: new Date(Date.now() - 31 * 60_000) },
    });
    await app.get(MaintenanceService).escalateStaleCancellationRequests();
    expect(
      await prisma.orderCancellationRequest.findUnique({
        where: { orderId: id },
      }),
    ).toMatchObject({ status: 'SUPPORT_REVIEW' });
    expect(
      await prisma.orderNotification.count({
        where: { orderId: id, event: 'CANCELLATION_ESCALATED' },
      }),
    ).toBe(2);
  });

  it('allows only one concurrent order to reserve a limited platform voucher and releases it on cancellation', async () => {
    const first = await fixture();
    const second = await fixture();
    const voucher = await prisma.voucher.create({
      data: {
        code: `TEST${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`,
        issuer: 'PLATFORM',
        discountType: 'FIXED_AMOUNT',
        value: 10000,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000),
        usageLimit: 1,
        perCustomerLimit: 1,
      },
    });
    const prepared: { token: string; body: object; quoteToken: string }[] = [];
    for (const identity of [first, second]) {
      const body = { ...scheduledBody(identity), voucherCode: voucher.code };
      const quote = await request(app.getHttpServer())
        .post('/api/orders/quote')
        .auth(identity.token, { type: 'bearer' })
        .send(body)
        .expect(200);
      prepared.push({
        token: identity.token,
        body,
        quoteToken: (quote.body as { data: { quoteToken: string } }).data
          .quoteToken,
      });
    }
    const results = await Promise.all(
      prepared.map((item) =>
        request(app.getHttpServer())
          .post('/api/orders')
          .auth(item.token, { type: 'bearer' })
          .set('Idempotency-Key', randomUUID())
          .send({ ...item.body, quoteToken: item.quoteToken }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const winnerIndex = results.findIndex((result) => result.status === 201);
    const winner = winnerIndex === 0 ? first : second;
    const loser = winnerIndex === 0 ? second : first;
    const orderId = (results[winnerIndex].body as { data: { id: string } }).data
      .id;
    expect(
      await prisma.voucherRedemption.count({
        where: { voucherId: voucher.id, status: 'RESERVED' },
      }),
    ).toBe(1);
    expect(
      await prisma.serviceOrder.findUnique({ where: { id: orderId } }),
    ).toMatchObject({
      servicePriceAmount: 100000,
      discountAmount: 10000,
      totalAmount: 90000,
      platformFundedAmount: 10000,
      commissionAmount: 10000,
    });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${orderId}/cancel`)
      .auth(winner.token, { type: 'bearer' })
      .send({ reason: 'Đổi lịch thử nghiệm.' })
      .expect(200);
    expect(
      await prisma.voucherRedemption.count({
        where: { voucherId: voucher.id, status: 'RELEASED' },
      }),
    ).toBe(1);
    await create(loser.token, {
      ...scheduledBody(loser),
      voucherCode: voucher.code,
    }).expect(201);
  });

  it('uses the discounted service price as the provider voucher commission base', async () => {
    const f = await fixture();
    const voucher = await prisma.voucher.create({
      data: {
        code: `TEST${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`,
        issuer: 'PROVIDER',
        providerId: f.provider.id,
        discountType: 'PERCENTAGE',
        value: 10,
        maxDiscountAmount: 20000,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000),
        usageLimit: 10,
        perCustomerLimit: 1,
      },
    });
    const result = await create(f.token, {
      ...scheduledBody(f),
      voucherCode: voucher.code,
    }).expect(201);
    const orderId = (result.body as { data: { id: string } }).data.id;
    expect(
      await prisma.serviceOrder.findUnique({ where: { id: orderId } }),
    ).toMatchObject({
      servicePriceAmount: 100000,
      discountAmount: 10000,
      totalAmount: 90000,
      providerFundedAmount: 10000,
      commissionAmount: 9000,
    });
    await action(f.providerToken, orderId, 'accept').expect(200);
    expect(
      await prisma.walletHold.findUnique({ where: { orderId } }),
    ).toMatchObject({ amount: 9000, status: 'ACTIVE' });
  });

  it('rematches only to a new provider and permits one concurrent retry', async () => {
    const metrics = app.get(ObservabilityMetrics);
    const selectedBefore = metrics.snapshot().events.rematch.selected;
    const original = await fixture();
    const alternative = await fixture();
    const replacement = await prisma.providerService.create({
      data: {
        providerId: alternative.provider.id,
        serviceId: original.service.serviceId,
        sourceApplicationId: alternative.service.sourceApplicationId,
        priceAmount: 120000,
        durationMinutes: 60,
        status: 'ACTIVE',
      },
    });
    const first = await create(original.token, scheduledBody(original)).expect(
      201,
    );
    const firstId = (first.body as { data: { id: string } }).data.id;
    await action(original.providerToken, firstId, 'reject', {
      reason: 'Không thể nhận lịch hẹn này.',
    }).expect(200);

    await request(app.getHttpServer())
      .get(`/api/me/orders/${firstId}/rematch-candidates`)
      .auth(alternative.providerToken, { type: 'bearer' })
      .expect(404);
    const response = await request(app.getHttpServer())
      .get(`/api/me/orders/${firstId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(200);
    const rematch = (
      response.body as {
        data: {
          orderDraft: Record<string, unknown>;
          candidates: { id: string; service: { id: string } }[];
        };
      }
    ).data;
    expect(rematch.candidates.map((item) => item.id)).not.toContain(
      original.provider.id,
    );
    expect(rematch.candidates.map((item) => item.id)).toContain(
      alternative.provider.id,
    );
    expect(rematch.orderDraft).toMatchObject({
      bookingType: 'SCHEDULED',
      contactName: original.customer.fullName,
      inlineAddress: { addressLine: original.address.addressLine },
    });
    const voucher = await prisma.voucher.create({
      data: {
        code: `TEST${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`,
        issuer: 'PLATFORM',
        discountType: 'FIXED_AMOUNT',
        value: 10000,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 86400000),
        usageLimit: 1,
        perCustomerLimit: 1,
      },
    });
    const quote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(original.token, { type: 'bearer' })
      .send({
        ...rematch.orderDraft,
        serviceId: undefined,
        contactName: undefined,
        contactPhone: undefined,
        customerNote: undefined,
        providerServiceId: replacement.id,
        voucherCode: voucher.code,
      })
      .expect(200);
    const quoteData = quote.body as {
      data: {
        quoteToken: string;
        servicePriceAmount: number;
        travelFeeAmount: number;
      };
    };
    const quoteToken = quoteData.data.quoteToken;
    expect(quoteToken).toBeTruthy();
    expect(quoteData.data.servicePriceAmount).toBe(120000);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${firstId}/retry`)
      .auth(alternative.providerToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerServiceId: replacement.id,
        quoteToken,
        voucherCode: voucher.code,
      })
      .expect(404);
    await prisma.providerService.update({
      where: { id: replacement.id },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .post(`/api/me/orders/${firstId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerServiceId: replacement.id,
        quoteToken,
        voucherCode: voucher.code,
      })
      .expect(404);
    await prisma.providerService.update({
      where: { id: replacement.id },
      data: { status: 'ACTIVE' },
    });
    const competing = await create(alternative.token, {
      providerServiceId: replacement.id,
      customerAddressId: alternative.address.id,
      bookingType: 'SCHEDULED',
      scheduledAt: rematch.orderDraft.scheduledAt,
    }).expect(201);
    const competingId = (competing.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .post(`/api/me/orders/${firstId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerServiceId: replacement.id,
        quoteToken,
        voucherCode: voucher.code,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${competingId}/cancel`)
      .auth(alternative.token, { type: 'bearer' })
      .send({ reason: 'Giải phóng lịch thử nghiệm.' })
      .expect(200);
    const sendRetry = (key: string) =>
      request(app.getHttpServer())
        .post(`/api/me/orders/${firstId}/retry`)
        .auth(original.token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({
          providerServiceId: replacement.id,
          quoteToken,
          voucherCode: voucher.code,
        });
    const firstKey = randomUUID();
    const secondKey = randomUUID();
    const [one, two] = await Promise.all([
      sendRetry(firstKey),
      sendRetry(secondKey),
    ]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
    const newId = (
      (one.status === 201 ? one : two).body as { data: { id: string } }
    ).data.id;
    const repeated = await sendRetry(one.status === 201 ? firstKey : secondKey);
    expect(repeated.status).toBe(201);
    expect((repeated.body as { data: { id: string } }).data.id).toBe(newId);
    expect(metrics.snapshot().events.rematch.selected - selectedBefore).toBe(1);
    const orders = await prisma.serviceOrder.findMany({
      where: {
        bookingGroupId: (first.body as { data: { bookingGroupId: string } })
          .data.bookingGroupId,
      },
      orderBy: { bookingAttempt: 'asc' },
    });
    expect(orders.map((order) => order.id)).toEqual([firstId, newId]);
    expect(orders.map((order) => order.bookingAttempt)).toEqual([1, 2]);
    expect(orders[1]).toMatchObject({
      providerId: alternative.provider.id,
      servicePriceAmount: 120000,
      discountAmount: 10000,
      voucherCode: voucher.code,
      addressLine: original.address.addressLine,
      status: 'PENDING_PROVIDER',
    });
    expect(
      await prisma.providerCalendarBlock.findUnique({
        where: { orderId: newId },
      }),
    ).toMatchObject({ providerId: alternative.provider.id });
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: newId } }),
    ).toBeNull();
    expect(
      await prisma.voucherRedemption.count({
        where: { voucherId: voucher.id, orderId: newId, status: 'RESERVED' },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .get(`/api/me/orders/${firstId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(409);
    await action(alternative.providerToken, newId, 'reject', {
      reason: 'Không thể nhận lịch hẹn này.',
    }).expect(200);
    expect(
      await prisma.providerCalendarBlock.findUnique({
        where: { orderId: newId },
      }),
    ).toMatchObject({ active: false });
    expect(
      await prisma.voucherRedemption.count({
        where: { voucherId: voucher.id, orderId: newId, status: 'RELEASED' },
      }),
    ).toBe(1);
    const third = await fixture();
    await prisma.providerProfile.update({
      where: { id: third.provider.id },
      data: { serviceAreaLatitude: point.latitude + 0.03 },
    });
    const thirdService = await prisma.providerService.create({
      data: {
        providerId: third.provider.id,
        serviceId: original.service.serviceId,
        sourceApplicationId: third.service.sourceApplicationId,
        priceAmount: 130000,
        durationMinutes: 60,
        status: 'ACTIVE',
      },
    });
    const thirdAttempt = await request(app.getHttpServer())
      .get(`/api/me/orders/${newId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(200);
    const thirdData = (
      thirdAttempt.body as {
        data: {
          orderDraft: Record<string, unknown>;
          candidates: { id: string }[];
        };
      }
    ).data;
    const remainingIds = thirdData.candidates.map((item) => item.id);
    expect(remainingIds).not.toContain(original.provider.id);
    expect(remainingIds).not.toContain(alternative.provider.id);
    expect(remainingIds).toContain(third.provider.id);
    const thirdQuote = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .auth(original.token, { type: 'bearer' })
      .send({
        ...thirdData.orderDraft,
        serviceId: undefined,
        contactName: undefined,
        contactPhone: undefined,
        customerNote: undefined,
        providerServiceId: thirdService.id,
      })
      .expect(200);
    const thirdQuoteData = thirdQuote.body as {
      data: {
        quoteToken: string;
        servicePriceAmount: number;
        travelFeeAmount: number;
      };
    };
    const thirdQuoteToken = thirdQuoteData.data.quoteToken;
    expect(thirdQuoteData.data.servicePriceAmount).toBe(130000);
    expect(thirdQuoteData.data.travelFeeAmount).toBeGreaterThan(
      quoteData.data.travelFeeAmount,
    );
    const thirdOrder = await request(app.getHttpServer())
      .post(`/api/me/orders/${newId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ providerServiceId: thirdService.id, quoteToken: thirdQuoteToken })
      .expect(201);
    const thirdOrderId = (thirdOrder.body as { data: { id: string } }).data.id;
    await action(third.providerToken, thirdOrderId, 'accept').expect(200);
    expect(
      await prisma.walletHold.findUnique({ where: { orderId: thirdOrderId } }),
    ).toMatchObject({
      status: 'ACTIVE',
    });
  });

  it('retries an expired request with the original snapshot and rejects invalid targets', async () => {
    const original = await fixture();
    const alternative = await fixture();
    const replacement = await prisma.providerService.create({
      data: {
        providerId: alternative.provider.id,
        serviceId: original.service.serviceId,
        sourceApplicationId: alternative.service.sourceApplicationId,
        priceAmount: 120000,
        durationMinutes: 60,
        status: 'ACTIVE',
      },
    });
    const first = await create(original.token, {
      ...scheduledBody(original),
      contactName: 'Khách nhận dịch vụ',
      contactPhone: '0912345678',
      customerNote: 'Gọi trước khi đến.',
    }).expect(201);
    const sourceId = (first.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .get(`/api/me/orders/${sourceId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(409);
    await prisma.serviceOrder.update({
      where: { id: sourceId },
      data: { providerResponseDeadlineAt: new Date(Date.now() - 1000) },
    });
    await prisma.$transaction((tx) =>
      app
        .get(BookingCalendarService)
        .releaseExpired(tx, original.provider.id, new Date()),
    );
    const response = await request(app.getHttpServer())
      .get(`/api/me/orders/${sourceId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(200);
    const draft = (
      response.body as { data: { orderDraft: Record<string, unknown> } }
    ).data.orderDraft;
    const quoteFor = async (providerServiceId: string) => {
      const quote = await request(app.getHttpServer())
        .post('/api/orders/quote')
        .auth(original.token, { type: 'bearer' })
        .send({
          providerServiceId,
          bookingType: draft.bookingType,
          scheduledAt: draft.scheduledAt,
          inlineAddress: draft.inlineAddress,
        })
        .expect(200);
      return (quote.body as { data: { quoteToken: string } }).data.quoteToken;
    };
    // Valid quotes do not authorize changing the original need or retrying a tried provider.
    for (const providerServiceId of [
      original.service.id,
      alternative.service.id,
    ]) {
      await request(app.getHttpServer())
        .post(`/api/me/orders/${sourceId}/retry`)
        .auth(original.token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({
          providerServiceId,
          quoteToken: await quoteFor(providerServiceId),
        })
        .expect(409);
    }
    const quoteToken = await quoteFor(replacement.id);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${sourceId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .send({ providerServiceId: replacement.id, quoteToken })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/me/orders/${sourceId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        providerServiceId: replacement.id,
        quoteToken,
        contactPhone: '0988888888',
      })
      .expect(400);
    const retry = await request(app.getHttpServer())
      .post(`/api/me/orders/${sourceId}/retry`)
      .auth(original.token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ providerServiceId: replacement.id, quoteToken })
      .expect(201);
    const retryId = (retry.body as { data: { id: string } }).data.id;
    expect(
      await prisma.serviceOrder.findUnique({ where: { id: sourceId } }),
    ).toMatchObject({ status: 'EXPIRED' });
    expect(
      await prisma.serviceOrder.findUnique({ where: { id: retryId } }),
    ).toMatchObject({
      status: 'PENDING_PROVIDER',
      bookingAttempt: 2,
      contactName: 'Khách nhận dịch vụ',
      contactPhone: '0912345678',
      customerNote: 'Gọi trước khi đến.',
      addressLine: original.address.addressLine,
    });
    const metrics = app.get(ObservabilityMetrics);
    const acceptedBefore = metrics.snapshot().events.rematch.accepted;
    const accepted = await Promise.all([
      action(alternative.providerToken, retryId, 'accept'),
      action(alternative.providerToken, retryId, 'accept'),
    ]);
    expect(accepted.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(metrics.snapshot().events.rematch.accepted - acceptedBefore).toBe(1);
  });

  it('does not offer an ASAP provider after their live location disappears', async () => {
    const original = await fixture();
    const alternative = await fixture();
    await prisma.providerService.create({
      data: {
        providerId: alternative.provider.id,
        serviceId: original.service.serviceId,
        sourceApplicationId: alternative.service.sourceApplicationId,
        priceAmount: 120000,
        durationMinutes: 60,
        status: 'ACTIVE',
      },
    });
    const first = await create(original.token, {
      providerServiceId: original.service.id,
      customerAddressId: original.address.id,
      bookingType: 'ASAP',
    }).expect(201);
    const sourceId = (first.body as { data: { id: string } }).data.id;
    await action(original.providerToken, sourceId, 'reject', {
      reason: 'Không thể nhận lịch hẹn này.',
    }).expect(200);
    locations.findNearby
      .mockResolvedValueOnce([
        { providerId: original.provider.id, distanceKm: 1 },
        { providerId: alternative.provider.id, distanceKm: 1 },
      ])
      .mockResolvedValueOnce([
        { providerId: original.provider.id, distanceKm: 1 },
      ]);
    const online = await request(app.getHttpServer())
      .get(`/api/me/orders/${sourceId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(200);
    expect(
      (
        online.body as { data: { candidates: { id: string }[] } }
      ).data.candidates.map((candidate) => candidate.id),
    ).toContain(alternative.provider.id);
    const offline = await request(app.getHttpServer())
      .get(`/api/me/orders/${sourceId}/rematch-candidates`)
      .auth(original.token, { type: 'bearer' })
      .expect(200);
    expect(
      (offline.body as { data: { candidates: { id: string }[] } }).data
        .candidates,
    ).toEqual([]);
  });
});
