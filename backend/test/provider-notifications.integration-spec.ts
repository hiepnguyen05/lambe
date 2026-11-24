import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestUser } from './support/provider-members.fixture';
import { ProviderNotificationRelayService } from '../src/modules/provider-notifications/application/provider-notification-relay.service';
import { ProviderNotificationSignalsService } from '../src/modules/provider-notifications/application/provider-notification-signals.service';
import { ProviderNotificationsService } from '../src/modules/provider-notifications/application/provider-notifications.service';
import { PushOutboxService } from '../src/modules/push/application/push-outbox.service';
import { OrderPushRelayService } from '../src/modules/push/application/order-push-relay.service';
import type { FirebaseIdentityService } from '../src/infrastructure/firebase/firebase-identity.service';

const send = jest.fn(() => Promise.resolve('fake-fcm-id'));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send }),
}));
type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface Notice {
  id: string;
  event: string;
  providerId: string;
  memberId: string | null;
  resolvedAt: string | null;
  readAt: string | null;
  deepLink: string;
}
interface Envelope<T> {
  data: T;
  meta?: { nextCursor: string | null; unreadCount: number };
}
const basePath = '/api/me/provider/notifications';

describe('provider notifications — PostgreSQL, Redis, canonical recipients and fake FCM', () => {
  let c: Context,
    relay: ProviderNotificationRelayService,
    delivery: PushOutboxService,
    baseUrl: string;
  const http = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const fixture = () => memberCapabilitiesFixture(c);
  const colleague = (f: Worker) =>
    memberCapabilitiesFixture(c, { owner: f.owner, provider: f.provider });
  const ownerList = (f: Worker, query: object = {}) =>
    http().get(basePath).set('Authorization', auth(f.owner.token)).query(query);
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
    relay = c.app.get(ProviderNotificationRelayService);
    baseUrl = await c.app.getUrl();
    delivery = new PushOutboxService(
      c.prisma,
      {
        getFirebaseApp: () => Promise.resolve({}),
      } as unknown as FirebaseIdentityService,
      new ConfigService({
        firebase: { enabled: true },
        provider: { minReceivingBalanceAmount: 50000 },
      }),
    );
  });
  beforeEach(() => send.mockClear());
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });
  async function flush(f: Worker) {
    for (let attempt = 0; attempt < 30; attempt++) {
      await relay.flush();
      const pending =
        (await c.prisma.providerWalletSignal.count({
          where: { wallet: { providerId: f.provider.id } },
        })) +
        (await c.prisma.providerAccountSignal.count({
          where: { userId: f.worker.id },
        })) +
        (await c.prisma.providerOperationalNotification.count({
          where: {
            providerId: f.provider.id,
            OR: [{ streamSequence: null }, { pushQueuedAt: null }],
          },
        }));
      if (!pending) return;
    }
    throw new Error('Scoped notification signals did not drain');
  }
  async function low(f: Worker, amount = 49999) {
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: amount },
    });
    await flush(f);
    return c.prisma.providerOperationalNotification.findFirstOrThrow({
      where: {
        providerId: f.provider.id,
        event: 'WALLET_LOW_BALANCE',
        resolvedAt: null,
      },
    });
  }
  async function device(user: { id: string; token: string }) {
    const session = await c.prisma.userSession.findFirstOrThrow({
      where: { userId: user.id },
    });
    const token = `fake-device-${randomUUID()}`;
    return c.prisma.userPushDevice.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        token,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        platform: 'ANDROID',
        deviceId: randomUUID(),
      },
    });
  }
  async function drainPush(id: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await delivery.deliverPending();
      const row = await c.prisma.pushOutbox.findUniqueOrThrow({
        where: { id },
      });
      if (row.sentAt || row.failedAt) return row;
    }
    throw new Error('Push was not processed');
  }
  async function order(f: Worker) {
    const customer = await memberTestUser(c.prisma, c.jwt);
    const start = new Date(Date.now() + 86400000);
    const row = await c.prisma.serviceOrder.create({
      data: {
        providerId: f.provider.id,
        customerId: customer.id,
        providerServiceId: f.offering.id,
        assignedMemberId: f.member.id,
        assignedMemberVersion: 1,
        assignedMemberUserId: f.worker.id,
        assignedMemberName: 'PRIVATE WORKER NAME',
        providerDisplayName: 'PRIVATE ORGANIZATION NAME',
        bookingType: 'SCHEDULED',
        status: 'PENDING_PROVIDER',
        expectedStartAt: start,
        expectedEndAt: new Date(start.getTime() + 3600000),
        serviceName: 'Test service',
        servicePriceAmount: 150000,
        subtotalAmount: 150000,
        totalAmount: 150000,
        durationMinutes: 60,
        commissionRateBps: 1000,
        commissionAmount: 15000,
        addressLabel: 'HOME',
        addressLine: 'PRIVATE CUSTOMER ADDRESS',
        addressLatitude: 21.0285,
        addressLongitude: 105.8542,
        contactPhone: customer.phone,
        providerResponseDeadlineAt: new Date(Date.now() + 600000),
      },
    });
    return { row, customer };
  }

  it('creates one low-balance alert per episode, resolves it after funding and never mutates money', async () => {
    const f = await fixture(),
      alert = await low(f);
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 49000 },
    });
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: { providerId: f.provider.id, event: 'WALLET_LOW_BALANCE' },
      }),
    ).toBe(1);
    expect((await ownerList(f).expect(200)).body).toMatchObject({
      data: [
        {
          id: alert.id,
          recipientRole: 'PROVIDER_OWNER',
          deepLink: '/provider/wallet',
        },
      ],
      meta: { unreadCount: 1 },
    });
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 50000 },
    });
    await flush(f);
    expect(
      (
        await c.prisma.providerOperationalNotification.findUniqueOrThrow({
          where: { id: alert.id },
        })
      ).resolvedAt,
    ).not.toBeNull();
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    expect(wallet).toMatchObject({ balanceAmount: 50000, heldAmount: 0 });
    expect(
      await c.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ).toBe(0);
    const second = await low(f);
    expect(second.id).not.toBe(alert.id);
  });

  it('uses available funds after holds and the configured receiving minimum', async () => {
    const f = await fixture();
    await c.prisma.providerWallet.update({
      where: { providerId: f.provider.id },
      data: { balanceAmount: 70000, heldAmount: 20001 },
    });
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'WALLET_LOW_BALANCE',
          resolvedAt: null,
        },
      }),
    ).toBe(1);
    const higher = await fixture(),
      config = c.app.get(ConfigService),
      original = config.get<number>('provider.minReceivingBalanceAmount');
    config.set('provider.minReceivingBalanceAmount', 100000);
    try {
      await low(higher, 90000);
    } finally {
      config.set('provider.minReceivingBalanceAmount', original);
    }
  });

  it('requires owner authentication and scopes detail/read/cursors to that owner', async () => {
    const f = await fixture(),
      alert = await low(f),
      other = await fixture(),
      customer = await memberTestUser(c.prisma, c.jwt);
    await http().get(basePath).expect(401);
    for (const token of [f.worker.token, customer.token])
      await http().get(basePath).set('Authorization', auth(token)).expect(403);
    for (const route of [
      http().get(`${basePath}/${alert.id}`),
      http().patch(`${basePath}/${alert.id}/read`),
    ])
      await route.set('Authorization', auth(other.owner.token)).expect(404);
    await ownerList(other, { cursor: alert.id }).expect(400);
    await http()
      .patch(`${basePath}/${alert.id}/read`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    await http()
      .patch(`${basePath}/${alert.id}/read`)
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    expect((await ownerList(f).expect(200)).body).toMatchObject({
      meta: { unreadCount: 0 },
    });
    for (const query of [{ limit: 0 }, { limit: 51 }, { cursor: 'invalid' }])
      await ownerList(f, query).expect(400);
  });

  it('records member suspension/leave and organization suspension only once per transition', async () => {
    const f = await fixture();
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'SUSPENDED' },
    });
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'SUSPENDED' },
    });
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: { providerId: f.provider.id, event: 'MEMBER_SUSPENDED' },
      }),
    ).toBe(1);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'ACTIVE' },
    });
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'MEMBER_SUSPENDED',
          resolvedAt: null,
        },
      }),
    ).toBe(0);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'LEFT', leftAt: new Date() },
    });
    await c.prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'SUSPENDED' },
    });
    const page = (await ownerList(f).expect(200)).body as Envelope<Notice[]>;
    expect(page.data.map((n) => n.event).sort()).toEqual([
      'MEMBER_LEFT',
      'MEMBER_SUSPENDED',
      'PROVIDER_SUSPENDED',
    ]);
    expect(page.data.find((n) => n.event === 'MEMBER_LEFT')).toMatchObject({
      memberId: f.member.id,
      deepLink: `/provider/members/${f.member.id}`,
    });
  });

  it('queues account restriction without holding a provider lock and resolves it after restoration', async () => {
    const f = await fixture();
    await c.prisma.user.update({
      where: { id: f.worker.id },
      data: { status: 'BLOCKED' },
    });
    expect(
      await c.prisma.providerAccountSignal.count({
        where: { userId: f.worker.id },
      }),
    ).toBe(1);
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'MEMBER_ACCOUNT_RESTRICTED',
          resolvedAt: null,
        },
      }),
    ).toBe(1);
    await c.prisma.user.update({
      where: { id: f.worker.id },
      data: { status: 'ACTIVE' },
    });
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'MEMBER_ACCOUNT_RESTRICTED',
          resolvedAt: null,
        },
      }),
    ).toBe(0);
  });

  it('coalesces wallet changes and tolerates concurrent relays without duplicate alerts', async () => {
    const f = await fixture();
    await Promise.all(
      Array.from({ length: 10 }, () =>
        c.prisma.providerWallet.update({
          where: { providerId: f.provider.id },
          data: { balanceAmount: 40000 },
        }),
      ),
    );
    expect(
      await c.prisma.providerWalletSignal.count({
        where: { wallet: { providerId: f.provider.id } },
      }),
    ).toBe(1);
    const another = new ProviderNotificationRelayService(
      c.prisma,
      c.app.get(ProviderNotificationSignalsService),
      c.cache,
      c.app.get(PushOutboxService),
    );
    await Promise.all([relay.flush(), another.flush()]);
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'WALLET_LOW_BALANCE',
          resolvedAt: null,
        },
      }),
    ).toBe(1);
  });

  it('routes requested-order pushes to the assigned worker, excluding owner, colleagues and customer', async () => {
    const f = await fixture(),
      b = await colleague(f),
      { row, customer } = await order(f);
    for (const user of [f.owner, f.worker, b.worker, customer])
      await device(user);
    await c.prisma.orderNotification.createMany({
      data: [f.owner.id, f.worker.id, b.worker.id].map((userId) => ({
        userId,
        orderId: row.id,
        event: 'ORDER_REQUESTED',
      })),
    });
    await c.app.get(OrderPushRelayService).enqueuePending();
    expect(
      (
        await c.prisma.pushOutbox.findMany({
          where: { entityType: 'ORDER', entityId: row.id },
          select: { userId: true },
        })
      ).map((p) => p.userId),
    ).toEqual([f.worker.id]);
    const ownerHistory = await http()
      .get('/api/me/notifications')
      .set('Authorization', auth(f.owner.token))
      .expect(200);
    expect(
      (ownerHistory.body as Envelope<{ orderId: string }[]>).data.map(
        (n) => n.orderId,
      ),
    ).not.toContain(row.id);
  });

  it.each(['SUSPEND', 'REJOIN', 'RESTRICT', 'EXPIRE'] as const)(
    'rechecks order push eligibility before FCM on %s',
    async (change) => {
      const f = await fixture(),
        { row } = await order(f);
      await device(f.worker);
      const notice = await c.prisma.orderNotification.create({
        data: {
          userId: f.worker.id,
          orderId: row.id,
          event: 'ORDER_REQUESTED',
        },
      });
      await c.app.get(OrderPushRelayService).enqueuePending();
      const push = await c.prisma.pushOutbox.findFirstOrThrow({
        where: { sourceId: notice.id },
      });
      if (change === 'SUSPEND')
        await c.prisma.providerMember.update({
          where: { id: f.member.id },
          data: { status: 'SUSPENDED' },
        });
      if (change === 'REJOIN')
        await c.prisma.providerMember.update({
          where: { id: f.member.id },
          data: { membershipVersion: 2 },
        });
      if (change === 'RESTRICT')
        await c.prisma.user.update({
          where: { id: f.worker.id },
          data: { status: 'BLOCKED' },
        });
      if (change === 'EXPIRE')
        await c.prisma.serviceOrder.update({
          where: { id: row.id },
          data: { status: 'EXPIRED' },
        });
      expect((await drainPush(push.id)).failedAt).not.toBeNull();
      expect(JSON.stringify(send.mock.calls)).not.toContain(row.id);
    },
  );

  it('sends owner-only static push payloads and drops a recovered wallet alert already queued', async () => {
    const f = await fixture(),
      ownerDevice = await device(f.owner);
    await device(f.worker);
    const alert = await low(f);
    const queued = await c.prisma.pushOutbox.findMany({
      where: { entityType: 'PROVIDER_NOTIFICATION', entityId: alert.id },
    });
    expect(queued.map((q) => q.userId)).toEqual([f.owner.id]);
    expect((await drainPush(queued[0].id)).sentAt).not.toBeNull();
    const messages = send.mock.calls as unknown as [
      {
        token: string;
        data: Record<string, string>;
        notification: { title: string; body: string };
      },
    ][];
    const message = messages
      .map(([m]) => m)
      .find((m) => m.token === ownerDevice.token)!;
    expect(Object.keys(message.data).sort()).toEqual([
      'deepLink',
      'entityId',
      'entityType',
      'event',
      'notificationId',
      'recipientRole',
    ]);
    expect(message.data).toMatchObject({
      entityType: 'PROVIDER_NOTIFICATION',
      entityId: alert.id,
      notificationId: alert.id,
      recipientRole: 'PROVIDER_OWNER',
    });
    expect(JSON.stringify(message)).not.toContain('49999');
    expect(JSON.stringify(message)).not.toContain(f.worker.phone);
    const other = await fixture();
    await device(other.owner);
    const stale = await low(other);
    const stalePush = await c.prisma.pushOutbox.findFirstOrThrow({
      where: { entityId: stale.id },
    });
    await c.prisma.providerWallet.update({
      where: { providerId: other.provider.id },
      data: { balanceAmount: 200000 },
    });
    expect((await drainPush(stalePush.id)).failedAt).not.toBeNull();
  });

  it('keeps owner stream ordering when an older transaction commits after a newer one', async () => {
    const f = await fixture(),
      b = await colleague(f);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      ready = new Promise<void>((resolve) => {
        started = resolve;
      });
    const slow = c.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT CURRENT_TIMESTAMP`;
        started();
        await gate;
        await tx.providerMember.update({
          where: { id: b.member.id },
          data: { status: 'SUSPENDED' },
        });
      },
      { timeout: 20000 },
    );
    try {
      await ready;
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: { status: 'SUSPENDED' },
      });
      await flush(f);
      const first =
        await c.prisma.providerOperationalNotification.findFirstOrThrow({
          where: { memberId: f.member.id },
        });
      release();
      await slow;
      await flush(f);
      const later = await c.app
        .get(ProviderNotificationsService)
        .changesSince(f.owner.id, first.id);
      expect(later.map((n) => n.memberId)).toContain(b.member.id);
    } finally {
      release();
      await slow;
    }
  });

  it('serves owner SSE, rejects workers and closes after owner account restriction', async () => {
    const f = await fixture();
    await http()
      .get(`${basePath}/events`)
      .set('Authorization', auth(f.worker.token))
      .expect(403);
    const controller = new AbortController();
    const stream = await fetch(`${baseUrl}${basePath}/events`, {
      headers: { Authorization: auth(f.owner.token) },
      signal: controller.signal,
    });
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    try {
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: { status: 'SUSPENDED' },
      });
      await flush(f);
      const frame = await reader.read();
      expect(new TextDecoder().decode(frame.value)).toContain(
        'MEMBER_SUSPENDED',
      );
      await c.prisma.user.update({
        where: { id: f.owner.id },
        data: { status: 'BLOCKED' },
      });
      await c.cache.publishOrderNotification(f.owner.id);
      expect((await reader.read()).done).toBe(true);
    } finally {
      controller.abort();
      await reader.cancel().catch(() => undefined);
    }
  });

  it('records account restriction without waiting for a provider lock and processes it after release', async () => {
    const f = await fixture();
    let release!: () => void, ready!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      locked = new Promise<void>((resolve) => {
        ready = resolve;
      });
    const hold = c.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM provider_profiles WHERE id=${f.provider.id} FOR UPDATE`;
        ready();
        await gate;
      },
      { timeout: 10000 },
    );
    try {
      await locked;
      await c.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout='1s'`;
        await tx.user.update({
          where: { id: f.worker.id },
          data: { status: 'BLOCKED' },
        });
      });
      await relay.flush();
      expect(
        await c.prisma.providerAccountSignal.count({
          where: { userId: f.worker.id },
        }),
      ).toBe(1);
    } finally {
      release();
      await hold;
    }
    await flush(f);
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: {
          providerId: f.provider.id,
          event: 'MEMBER_ACCOUNT_RESTRICTED',
        },
      }),
    ).toBe(1);
  });

  it('does not wait on an uncommitted wallet change and resolves the alert after its commit', async () => {
    const f = await fixture(),
      alert = await low(f);
    let release!: () => void, ready!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      locked = new Promise<void>((resolve) => {
        ready = resolve;
      });
    const hold = c.prisma.$transaction(
      async (tx) => {
        await tx.providerWallet.update({
          where: { providerId: f.provider.id },
          data: { balanceAmount: 200000 },
        });
        ready();
        await gate;
      },
      { timeout: 10000 },
    );
    try {
      await locked;
      await relay.flush();
    } finally {
      release();
      await hold;
    }
    await flush(f);
    expect(
      (
        await c.prisma.providerOperationalNotification.findUniqueOrThrow({
          where: { id: alert.id },
        })
      ).resolvedAt,
    ).not.toBeNull();
    expect(
      (
        await c.prisma.providerWallet.findUniqueOrThrow({
          where: { providerId: f.provider.id },
        })
      ).balanceAmount,
    ).toBe(200000);
  });

  it('keeps push queueing and durable stream replay working during a Redis outage', async () => {
    const f = await fixture();
    await device(f.owner);
    const offline = jest.spyOn(c.cache, 'getStatus').mockReturnValue('down');
    try {
      const alert = await low(f);
      expect(
        await c.prisma.pushOutbox.count({
          where: { entityType: 'PROVIDER_NOTIFICATION', entityId: alert.id },
        }),
      ).toBe(1);
      expect(
        (
          await c.app.get(ProviderNotificationsService).changesSince(f.owner.id)
        ).map((n) => n.id),
      ).toContain(alert.id);
      expect(
        (
          await c.prisma.providerOperationalNotification.findUniqueOrThrow({
            where: { id: alert.id },
          })
        ).publishedAt,
      ).toBeNull();
    } finally {
      offline.mockRestore();
    }
    await flush(f);
  });

  it('guards immutable recipients and leaves wallet/order history untouched on rolled-back events', async () => {
    const f = await fixture(),
      notice = await low(f),
      b = await colleague(f);
    await expect(
      c.prisma.providerOperationalNotification.update({
        where: { id: notice.id },
        data: { userId: b.worker.id },
      }),
    ).rejects.toThrow('Operational notification context is immutable');
    const count = await c.prisma.providerOperationalNotification.count({
      where: { providerId: f.provider.id },
    });
    await expect(
      c.prisma.$transaction(async (tx) => {
        await tx.providerMember.update({
          where: { id: f.member.id },
          data: { status: 'SUSPENDED' },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      await c.prisma.providerOperationalNotification.count({
        where: { providerId: f.provider.id },
      }),
    ).toBe(count);
  });
});
