import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../src/infrastructure/audit/audit.service';
import { PROVIDER_LOCATION_STORE } from '../src/infrastructure/location/provider-location.store';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrdersService } from '../src/modules/orders/application/orders.service';
import { OrderEligibilityService } from '../src/modules/orders/application/order-eligibility.service';
import { OrderBookingService } from '../src/modules/orders/application/booking/order-booking.service';
import { OrderWalletService } from '../src/modules/orders/application/payments/order-wallet.service';
import { BookingCalendarService } from '../src/modules/orders/application/scheduling/booking-calendar.service';
import { BookingAvailabilityService } from '../src/modules/orders/application/scheduling/booking-availability.service';
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
import { OrderEvidenceController } from '../src/modules/orders/controllers/order-evidence.controller';
import { OrderNotificationsController } from '../src/modules/orders/controllers/order-notifications.controller';
import { ProviderReviewsController } from '../src/modules/orders/controllers/provider-reviews.controller';
import { MEDIA_STORAGE } from '../src/modules/upload/application/media-storage.port';
import { ChatService } from '../src/modules/chat/application/chat.service';
import { ChatQueryService } from '../src/modules/chat/application/chat-query.service';
import { ChatModerationService } from '../src/modules/chat/application/chat-moderation.service';
import { ChatController } from '../src/modules/chat/controllers/chat.controller';

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
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.startsWith('/lambe_booking_test_'))
      throw new Error(
        'TEST_DATABASE_URL must point to an isolated lambe_booking_test_* database.',
      );
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
      ],
      providers: [
        OrdersService,
        OrderEligibilityService,
        OrderBookingService,
        ChatService,
        ChatQueryService,
        ChatModerationService,
        OrderWalletService,
        OrderCancellationService,
        OrderReviewService,
        OrderEvidenceService,
        OrderNotificationsService,
        BookingCalendarService,
        BookingAvailabilityService,
        AuditService,
        JwtAuthGuard,
        ProviderDiscoveryService,
        ScheduledProviderCandidatesService,
        MaintenanceService,
        {
          provide: ConfigService,
          useValue: { get: (_: string, fallback: unknown) => fallback },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: PROVIDER_LOCATION_STORE, useValue: locations },
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

  function create(token: string, body: object, key = randomUUID()) {
    return request(app.getHttpServer())
      .post('/api/orders')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  }

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
    const started = performance.now();
    const results = await Promise.all(
      identities.map((identity) =>
        create(identity.token, {
          ...scheduledBody(f),
          customerAddressId: identity.addressId,
        }),
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
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => create(f.token, scheduledBody(f), key)),
    );
    expect(responses.every((result) => result.status === 201)).toBe(true);
    const ids = responses.map(
      (result) => (result.body as { data: { id: string } }).data.id,
    );
    expect(new Set(ids).size).toBe(1);
    await create(
      f.token,
      { ...scheduledBody(f), customerNote: 'different' },
      key,
    ).expect(409);
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
    await action(f.providerToken, id, 'arrive').expect(200);
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
    await create(f.token, scheduledBody(f)).expect(409);
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
    await create(f.token, {
      ...scheduledBody(f),
      scheduledAt: tooClose,
    }).expect(409);
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
    await action(f.providerToken, id, 'arrive').expect(409);
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
    await action(f.providerToken, id, 'arrive').expect(200);
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
    await action(f.providerToken, id, 'arrive').expect(409);
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
    await action(f.providerToken, id, 'arrive').expect(200);
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
});
