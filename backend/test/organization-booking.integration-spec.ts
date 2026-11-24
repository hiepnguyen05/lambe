import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestUser } from './support/provider-members.fixture';
import type { CreateOrderDto } from '../src/modules/orders/dto/order.dto';
import { OrderCancellationService } from '../src/modules/orders/application/cancellation/order-cancellation.service';
import { OrderPaymentDisputeService } from '../src/modules/orders/application/payments/order-payment-dispute.service';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface OrderResponse {
  data: {
    id: string;
    status: string;
    assignedMemberId: string;
    assignedMember: { id: string; displayName: string };
    provider: { displayName: string };
    expectedStartAt: string;
    expectedEndAt: string;
    totalAmount: number;
    quoteToken?: string;
  };
}
interface QuoteResponse {
  data: {
    available: boolean;
    quoteToken: string;
    memberId: string;
    reason: string | null;
  };
}
interface DiscoveryResponse {
  data: {
    memberId: string | null;
    providerId: string;
    available: boolean;
    reason: string | null;
    suggestedSlots: { startAt: string }[];
  }[];
}

describe('organization worker booking — full AppModule, PostgreSQL and Redis', () => {
  let c: Context;
  const onlineMembers: string[] = [];
  const client = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const providerPath = (id: string) => `/api/me/provider/orders/${id}`;
  // Keep travel-buffer cases away from the separate cross-midnight hours rule.
  const scheduledDay = new Date(Date.now() + 2 * 86_400_000);
  scheduledDay.setUTCHours(3, 0, 0, 0); // 10:00 in Vietnam, independent of test run time.
  const scheduledBase = scheduledDay.getTime();
  const future = (offsetMinutes = 0) =>
    new Date(scheduledBase + offsetMinutes * 60_000).toISOString();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOQAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
  });
  afterAll(async () => {
    for (const id of onlineMembers)
      await c.cache.removeMemberPosition(id, 2_000_000_000);
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  async function worker(organization?: Worker) {
    const f = await memberCapabilitiesFixture(
      c,
      organization
        ? { owner: organization.owner, provider: organization.provider }
        : undefined,
    );
    if (organization) {
      await c.prisma.providerMemberVerification.update({
        where: { id: f.profile.id },
        data: { requestedProviderServiceIds: [organization.offering.id] },
      });
      await c.prisma.providerMemberDocument.updateMany({
        where: {
          verificationId: f.profile.id,
          providerServiceId: f.offering.id,
        },
        data: { providerServiceId: organization.offering.id },
      });
      await c.prisma.providerMemberService.updateMany({
        where: { memberId: f.member.id },
        data: { enabled: false },
      });
      await c.prisma.providerMemberService.create({
        data: {
          memberId: f.member.id,
          membershipVersion: 1,
          providerServiceId: organization.offering.id,
        },
      });
      return {
        ...f,
        offering: organization.offering,
        catalog: organization.catalog,
        category: organization.category,
      };
    }
    return f;
  }

  async function customer() {
    const user = await memberTestUser(c.prisma, c.jwt);
    const address = await c.prisma.customerAddress.create({
      data: {
        userId: user.id,
        label: 'Nhà kiểm thử',
        addressLine: 'Địa chỉ kiểm thử tại Hà Nội',
        latitude: 21.029,
        longitude: 105.855,
        contactName: 'Khách kiểm thử',
        contactPhone: user.phone,
        isMapConfirmed: true,
      },
    });
    return { ...user, address };
  }

  const body = (
    f: Worker,
    u: Awaited<ReturnType<typeof customer>>,
    at = future(),
  ): Omit<CreateOrderDto, 'quoteToken'> => ({
    providerServiceId: f.offering.id,
    memberId: f.member.id,
    customerAddressId: u.address.id,
    bookingType: 'SCHEDULED',
    scheduledAt: at,
  });
  const quote = (
    u: Awaited<ReturnType<typeof customer>>,
    dto: Omit<CreateOrderDto, 'quoteToken'>,
  ) =>
    client()
      .post('/api/orders/quote')
      .set('Authorization', auth(u.token))
      .send(dto);
  async function book(
    f: Worker,
    u: Awaited<ReturnType<typeof customer>>,
    at = future(),
  ) {
    const dto = body(f, u, at),
      q = await quote(u, dto).expect(200);
    expect((q.body as QuoteResponse).data.available).toBe(true);
    const response = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', randomUUID())
      .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
      .expect(201);
    return (response.body as OrderResponse).data;
  }
  const accept = (f: Worker, id: string, token = f.worker.token) =>
    client()
      .post(`${providerPath(id)}/accept`)
      .set('Authorization', auth(token))
      .send({});
  async function enable(f: Worker) {
    await client()
      .post(`/api/me/provider/memberships/${f.member.id}/availability/online`)
      .set('Authorization', auth(f.worker.token))
      .send({
        latitude: 21.0285,
        longitude: 105.8542,
        capturedAt: new Date().toISOString(),
      })
      .expect(200);
    onlineMembers.push(f.member.id);
  }
  const search = (
    f: Worker,
    u: Awaited<ReturnType<typeof customer>>,
    overrides = {},
  ) =>
    client()
      .post('/api/discovery/providers/search')
      .set('Authorization', auth(u.token))
      .send({
        serviceId: f.catalog.id,
        customerAddressId: u.address.id,
        bookingType: 'SCHEDULED',
        scheduledAt: future(),
        radiusKm: 10,
        ...overrides,
      });

  it('finds both qualified organization workers and exposes only public identity and assigned services', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    const response = await search(a, u).expect(200);
    expect(
      (response.body as DiscoveryResponse).data.map((x) => x.memberId).sort(),
    ).toEqual([a.member.id, b.member.id].sort());
    expect(JSON.stringify(response.body)).not.toMatch(
      /nationalId|phoneVerifiedAt|balanceAmount|lastHeartbeatAt|publicId/,
    );
    const profile = await client()
      .get(`/api/providers/${a.provider.id}/members/${b.member.id}`)
      .expect(200);
    expect(profile.body).toMatchObject({
      data: { id: b.member.id, organization: { id: a.provider.id } },
    });
  });

  it('requires selecting a worker for new organization bookings, and blocks self-booking', async () => {
    const f = await worker(),
      u = await customer();
    const dto = body(f, u);
    await quote(u, { ...dto, memberId: undefined }).expect(400);
    await quote(u, { ...dto, memberId: randomUUID() }).expect(409);
    const own = await c.prisma.customerAddress.create({
      data: {
        userId: f.worker.id,
        label: 'Nhà',
        addressLine: 'Địa chỉ kiểm thử của chính thợ',
        latitude: 21.029,
        longitude: 105.855,
      },
    });
    await client()
      .post('/api/orders/quote')
      .set('Authorization', auth(f.worker.token))
      .send({ ...dto, customerAddressId: own.id })
      .expect(400);
  });

  it('allows two customers to book and accept different workers at the same time in one organization', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer(),
      v = await customer();
    const [first, second] = await Promise.all([book(a, u), book(b, v)]);
    expect(first.assignedMemberId).toBe(a.member.id);
    expect(second.assignedMemberId).toBe(b.member.id);
    const responses = await Promise.all([
      accept(a, first.id),
      accept(b, second.id),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: a.provider.id },
    });
    expect(wallet.heldAmount).toBe(30_000);
    expect(
      await c.prisma.providerCalendarBlock.count({
        where: { providerId: a.provider.id, active: true },
      }),
    ).toBe(2);
  });

  it('concurrent customers contending for one worker create only one reservation', async () => {
    const f = await worker();
    const users = await Promise.all(
      Array.from({ length: 8 }, () => customer()),
    );
    const requests = await Promise.all(
      users.map(async (u) => ({
        u,
        dto: body(f, u),
        q: await quote(u, body(f, u)).expect(200),
      })),
    );
    const responses = await Promise.all(
      requests.map(({ u, dto, q }) =>
        client()
          .post('/api/orders')
          .set('Authorization', auth(u.token))
          .set('Idempotency-Key', randomUUID())
          .send({
            ...dto,
            quoteToken: (q.body as QuoteResponse).data.quoteToken,
          }),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
    expect(
      await c.prisma.providerCalendarBlock.count({
        where: { memberId: f.member.id, active: true },
      }),
    ).toBe(1);
  });

  it('prevents two workers from holding more shared wallet funds than available', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer(),
      v = await customer();
    await c.prisma.providerService.update({
      where: { id: a.offering.id },
      data: { priceAmount: 500_000 },
    });
    await c.prisma.providerWallet.update({
      where: { providerId: a.provider.id },
      data: { balanceAmount: 60_000 },
    });
    const [first, second] = await Promise.all([book(a, u), book(b, v)]);
    const responses = await Promise.all([
      accept(a, first.id),
      accept(b, second.id),
    ]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => [400, 409].includes(r.status))).toHaveLength(
      1,
    );
    expect(
      (
        await c.prisma.providerWallet.findUniqueOrThrow({
          where: { providerId: a.provider.id },
        })
      ).heldAmount,
    ).toBe(50_000);
  });

  it('binds quote and idempotency to the chosen worker; snapshots remain stable after profile changes', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    const dto = body(a, u);
    const q = await quote(u, dto).expect(200);
    const token = (q.body as QuoteResponse).data.quoteToken,
      key = randomUUID();
    await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', key)
      .send({ ...dto, memberId: b.member.id, quoteToken: token })
      .expect(409);
    const created = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', key)
      .send({ ...dto, quoteToken: token })
      .expect(201);
    const order = (created.body as OrderResponse).data;
    await c.prisma.providerMember.update({
      where: { id: a.member.id },
      data: { displayName: 'Tên mới' },
    });
    await c.prisma.providerProfile.update({
      where: { id: a.provider.id },
      data: { displayName: 'Tổ chức đổi tên' },
    });
    const read = await client()
      .get(`/api/me/orders/${order.id}`)
      .set('Authorization', auth(u.token))
      .expect(200);
    expect((read.body as OrderResponse).data.assignedMember.displayName).toBe(
      order.assignedMember.displayName,
    );
    expect((read.body as OrderResponse).data.provider.displayName).toBe(
      order.provider.displayName,
    );
    const replay = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', key)
      .send({ ...dto, quoteToken: token })
      .expect(201);
    expect((replay.body as OrderResponse).data.id).toBe(order.id);
    await expect(
      c.prisma.serviceOrder.update({
        where: { id: order.id },
        data: { assignedMemberId: b.member.id },
      }),
    ).rejects.toThrow();
  });

  it('only assigned worker accepts/rejects, while owner reads organization orders and other workers cannot', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    const order = await book(a, u);
    await accept(a, order.id, a.owner.token).expect(404);
    await accept(a, order.id, b.worker.token).expect(404);
    await client()
      .get(providerPath(order.id))
      .set('Authorization', auth(b.worker.token))
      .expect(404);
    await client()
      .get(providerPath(order.id))
      .set('Authorization', auth(a.owner.token))
      .expect(200);
    await accept(a, order.id).expect(200);
    expect(
      await c.prisma.orderNotification.count({
        where: {
          orderId: order.id,
          userId: a.worker.id,
          event: 'ORDER_REQUESTED',
        },
      }),
    ).toBe(1);
    expect(
      await c.prisma.orderNotification.count({
        where: {
          orderId: order.id,
          userId: a.owner.id,
          event: 'ORDER_REQUESTED',
        },
      }),
    ).toBe(0);
  });

  it('ASAP requires current member GPS, honors radius, and replays created requests after offline', async () => {
    const f = await worker(),
      u = await customer();
    expect(
      (
        await search(f, u, {
          bookingType: 'ASAP',
          scheduledAt: undefined,
        }).expect(200)
      ).body,
    ).toMatchObject({ data: [] });
    await enable(f);
    const dto = {
        ...body(f, u),
        bookingType: 'ASAP' as const,
        scheduledAt: undefined,
      },
      q = await quote(u, dto).expect(200),
      key = randomUUID();
    const created = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', key)
      .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
      .expect(201);
    await c.prisma.providerMemberAvailabilitySession.updateMany({
      where: { memberId: f.member.id, endedAt: null },
      data: { endedAt: new Date(), endReason: 'TEST_OFFLINE' },
    });
    const replay = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', key)
      .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
      .expect(201);
    expect((replay.body as OrderResponse).data.id).toBe(
      (created.body as OrderResponse).data.id,
    );
  });

  it('scheduled search respects member time-off and suggests the next free time', async () => {
    const f = await worker(),
      u = await customer();
    const at = future();
    await c.prisma.providerMemberTimeOff.create({
      data: {
        memberId: f.member.id,
        membershipVersion: 1,
        startAt: new Date(at),
        endAt: new Date(Date.parse(at) + 90 * 60_000),
      },
    });
    const result = await search(f, u).expect(200);
    const candidate = (result.body as DiscoveryResponse).data.find(
      (x) => x.memberId === f.member.id,
    )!;
    expect(candidate.available).toBe(false);
    expect(candidate.suggestedSlots.length).toBeGreaterThan(0);
    const q = await quote(u, body(f, u)).expect(200);
    expect((q.body as QuoteResponse).data.available).toBe(false);
  });

  it('rejects certificates that expire before the appointment finishes', async () => {
    const f = await worker(),
      u = await customer();
    await c.prisma.providerMemberDocument.updateMany({
      where: { verificationId: f.profile.id, type: 'PROFESSIONAL_CERTIFICATE' },
      data: { expiresAt: new Date(Date.parse(future()) + 30 * 60_000) },
    });
    await quote(u, body(f, u)).expect(409);
    expect((await search(f, u).expect(200)).body).toMatchObject({ data: [] });
  });

  it('rematch excludes the attempted member but allows another worker of the same organization', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    const order = await book(a, u);
    await client()
      .post(`${providerPath(order.id)}/reject`)
      .set('Authorization', auth(a.worker.token))
      .send({ reason: 'Không thể nhận khung giờ này.' })
      .expect(200);
    const result = await client()
      .get(`/api/me/orders/${order.id}/rematch-candidates`)
      .set('Authorization', auth(u.token))
      .expect(200);
    const candidates = (
      result.body as { data: { candidates: DiscoveryResponse['data'] } }
    ).data.candidates;
    expect(candidates.some((x) => x.memberId === a.member.id)).toBe(false);
    expect(candidates.some((x) => x.memberId === b.member.id)).toBe(true);
    const draft = (
      result.body as {
        data: {
          orderDraft: Omit<CreateOrderDto, 'quoteToken' | 'providerServiceId'>;
        };
      }
    ).data.orderDraft;
    const q = await quote(u, {
      providerServiceId: b.offering.id,
      memberId: b.member.id,
      inlineAddress: draft.inlineAddress,
      bookingType: draft.bookingType,
      scheduledAt: draft.scheduledAt,
    }).expect(200);
    const retried = await client()
      .post(`/api/me/orders/${order.id}/retry`)
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', randomUUID())
      .send({
        providerServiceId: b.offering.id,
        memberId: b.member.id,
        quoteToken: (q.body as QuoteResponse).data.quoteToken,
      })
      .expect(201);
    expect((retried.body as OrderResponse).data.assignedMemberId).toBe(
      b.member.id,
    );
  });

  it('performs the assigned worker lifecycle, private evidence, cash completion and commission exactly once', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    await enable(a);
    const dto = {
        ...body(a, u),
        bookingType: 'ASAP' as const,
        scheduledAt: undefined,
      },
      q = await quote(u, dto).expect(200);
    const result = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', randomUUID())
      .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
      .expect(201);
    const id = (result.body as OrderResponse).data.id;
    await accept(a, id).expect(200);
    await client()
      .put('/api/me/provider/member-receiving')
      .set('Authorization', auth(a.owner.token))
      .send({
        enabled: false,
        reason: 'Tạm dừng nhận đơn mới, hoàn tất đơn đang nhận.',
      })
      .expect(200);
    await client()
      .post(`${providerPath(id)}/en-route`)
      .set('Authorization', auth(b.worker.token))
      .send({})
      .expect(404);
    await client()
      .post(`${providerPath(id)}/en-route`)
      .set('Authorization', auth(a.worker.token))
      .send({})
      .expect(200);
    const position = {
      latitude: u.address.latitude,
      longitude: u.address.longitude,
      accuracyMeters: 10,
      capturedAt: new Date().toISOString(),
    };
    await client()
      .put(`${providerPath(id)}/location`)
      .set('Authorization', auth(b.worker.token))
      .send(position)
      .expect(404);
    await client()
      .put(`${providerPath(id)}/location`)
      .set('Authorization', auth(a.worker.token))
      .send(position)
      .expect(200);
    await client()
      .get(`/api/me/orders/${id}/tracking`)
      .set('Authorization', auth(u.token))
      .expect(200);
    await client()
      .post(`${providerPath(id)}/arrive`)
      .set('Authorization', auth(a.worker.token))
      .send({
        latitude: u.address.latitude,
        longitude: u.address.longitude,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      })
      .expect(200);
    const before = await client()
      .post(`${providerPath(id)}/evidence/BEFORE_WORK`)
      .set('Authorization', auth(a.worker.token))
      .attach('file', png, { filename: 'before.png', contentType: 'image/png' })
      .expect(201);
    const evidenceId = (before.body as { data: { id: string } }).data.id;
    await client()
      .get(`/api/orders/${id}/evidence/${evidenceId}`)
      .set('Authorization', auth(b.worker.token))
      .expect(404);
    await client()
      .post(`${providerPath(id)}/start`)
      .set('Authorization', auth(a.worker.token))
      .send({})
      .expect(200);
    await client()
      .post(`${providerPath(id)}/evidence/AFTER_WORK`)
      .set('Authorization', auth(a.worker.token))
      .attach('file', png, { filename: 'after.png', contentType: 'image/png' })
      .expect(201);
    await client()
      .post(`${providerPath(id)}/complete`)
      .set('Authorization', auth(a.worker.token))
      .send({ cashReceived: true })
      .expect(200);
    await client()
      .post(`${providerPath(id)}/complete`)
      .set('Authorization', auth(a.worker.token))
      .send({ cashReceived: true })
      .expect(409);
    const stored = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id },
    });
    expect(stored.cashCollectedByUserId).toBe(a.worker.id);
    expect(stored.cashCollectedAt).not.toBeNull();
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: a.provider.id },
    });
    expect(wallet.balanceAmount).toBe(185_000);
    expect(wallet.heldAmount).toBe(0);
  });

  it('keeps travel buffers per worker, while another worker remains available', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer(),
      v = await customer();
    const order = await book(a, u);
    await accept(a, order.id).expect(200);
    const soon = new Date(
      Date.parse(order.expectedEndAt) + 10 * 60_000,
    ).toISOString();
    const first = await quote(v, body(a, v, soon)).expect(200),
      second = await quote(v, body(b, v, soon)).expect(200);
    expect((first.body as QuoteResponse).data.available).toBe(false);
    expect((first.body as QuoteResponse).data.reason).toBe(
      'PROVIDER_TIME_CONFLICT',
    );
    expect((second.body as QuoteResponse).data.available).toBe(true);
  });

  it('reschedules only the assigned worker and does not collide with another worker’s appointment', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer(),
      v = await customer();
    const original = await book(a, u),
      other = await book(b, v, future(180));
    await accept(a, original.id).expect(200);
    await accept(b, other.id).expect(200);
    await client()
      .post(`/api/me/orders/${original.id}/reschedule`)
      .set('Authorization', auth(u.token))
      .send({ scheduledAt: future(180) })
      .expect(200);
    await client()
      .post(`${providerPath(original.id)}/reschedule/decision`)
      .set('Authorization', auth(a.owner.token))
      .send({ approve: true })
      .expect(404);
    await client()
      .post(`${providerPath(original.id)}/reschedule/decision`)
      .set('Authorization', auth(a.worker.token))
      .send({ approve: true })
      .expect(200);
    const stored = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(stored.assignedMemberId).toBe(a.member.id);
    expect(stored.expectedStartAt.toISOString()).toBe(future(180));
    expect(
      await c.prisma.orderNotification.count({
        where: {
          orderId: original.id,
          userId: a.worker.id,
          event: 'ORDER_RESCHEDULE_REQUESTED',
        },
      }),
    ).toBe(1);
  });

  it('gives a member an anonymous busy calendar and prevents other workers from reading it', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    await book(a, u);
    const path = `/api/me/provider/memberships/${a.member.id}/calendar`,
      range = { from: future(-120), to: future(300) };
    await client()
      .get(path)
      .set('Authorization', auth(b.worker.token))
      .query(range)
      .expect(404);
    const response = await client()
      .get(path)
      .set('Authorization', auth(a.worker.token))
      .query(range)
      .expect(200);
    expect((response.body as { data: unknown[] }).data.length).toBeGreaterThan(
      0,
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /customerId|contactPhone|addressLatitude|orderId/,
    );
    await client()
      .get(path)
      .set('Authorization', auth(a.owner.token))
      .query(range)
      .expect(200);
  });

  it('blocks new work after suspension but still lets the assigned user raise a safety report', async () => {
    const f = await worker(),
      u = await customer();
    const order = await book(f, u);
    await accept(f, order.id).expect(200);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: {
        status: 'SUSPENDED',
        suspendedFromStatus: 'ACTIVE',
        suspensionSource: 'INTERNAL',
      },
    });
    await client()
      .post(`${providerPath(order.id)}/en-route`)
      .set('Authorization', auth(f.worker.token))
      .send({})
      .expect(403);
    await client()
      .post(`${providerPath(order.id)}/safety/sos`)
      .set('Authorization', auth(f.worker.token))
      .send({ reason: 'THREAT', detail: 'Sự cố an toàn cần hỗ trợ ngay.' })
      .expect(200);
    expect(
      await c.prisma.orderSafetyReport.count({
        where: { reporterId: f.worker.id, incident: { orderId: order.id } },
      }),
    ).toBe(1);
  });

  it('allows a worker with no commitments to leave while a different worker has a booking', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    await book(b, u);
    await client()
      .post(`/api/me/provider/memberships/${a.member.id}/leave`)
      .set('Authorization', auth(a.worker.token))
      .send({})
      .expect(200);
    expect(
      (
        await c.prisma.providerMember.findUniqueOrThrow({
          where: { id: a.member.id },
        })
      ).status,
    ).toBe('LEFT');
    expect(
      await c.prisma.providerCalendarBlock.count({
        where: { memberId: b.member.id, active: true },
      }),
    ).toBe(1);
  });

  it('preserves legacy organization-wide calendar commitments for all new workers', async () => {
    const a = await worker(),
      b = await worker(a),
      u = await customer();
    await c.prisma.providerCalendarBlock.create({
      data: {
        providerId: a.provider.id,
        startAt: new Date(future()),
        endAt: new Date(future(120)),
        reason: 'Legacy commitment',
      },
    });
    expect((await quote(u, body(a, u)).expect(200)).body).toMatchObject({
      data: { available: false },
    });
    expect((await quote(u, body(b, u)).expect(200)).body).toMatchObject({
      data: { available: false },
    });
  });

  it('only extends a worker’s job with a service that worker is qualified and assigned to perform', async () => {
    const f = await worker(),
      u = await customer();
    await enable(f);
    const dto = {
        ...body(f, u),
        bookingType: 'ASAP' as const,
        scheduledAt: undefined,
      },
      q = await quote(u, dto).expect(200);
    const response = await client()
      .post('/api/orders')
      .set('Authorization', auth(u.token))
      .set('Idempotency-Key', randomUUID())
      .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
      .expect(201);
    const id = (response.body as OrderResponse).data.id;
    await accept(f, id).expect(200);
    await client()
      .post(`${providerPath(id)}/en-route`)
      .set('Authorization', auth(f.worker.token))
      .send({})
      .expect(200);
    await client()
      .post(`${providerPath(id)}/arrive`)
      .set('Authorization', auth(f.worker.token))
      .send({
        latitude: u.address.latitude,
        longitude: u.address.longitude,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      })
      .expect(200);
    const catalog = await c.prisma.service.create({
      data: {
        categoryId: f.category.id,
        code: `ADD_${randomUUID().replaceAll('-', '_').toUpperCase()}`,
        name: 'Dịch vụ phát sinh',
        normalizedName: `addon-${randomUUID()}`,
        slug: `addon-${randomUUID()}`,
        status: 'ACTIVE',
        minPriceAmount: 50_000,
        maxPriceAmount: 500_000,
        defaultDurationMinutes: 30,
        requiresCertificate: false,
        minPortfolioImages: 0,
      },
    });
    const offering = await c.prisma.providerService.create({
      data: {
        providerId: f.provider.id,
        sourceApplicationId: f.provider.sourceApplicationId,
        serviceId: catalog.id,
        status: 'ACTIVE',
        priceAmount: 100_000,
        durationMinutes: 30,
      },
    });
    const propose = () =>
      client()
        .post(`${providerPath(id)}/add-ons`)
        .set('Authorization', auth(f.worker.token))
        .set('Idempotency-Key', randomUUID())
        .send({ providerServiceId: offering.id });
    await propose().expect(409);
    await c.prisma.providerMemberVerification.update({
      where: { id: f.profile.id },
      data: { requestedProviderServiceIds: [f.offering.id, offering.id] },
    });
    await c.prisma.providerMemberService.create({
      data: {
        memberId: f.member.id,
        membershipVersion: 1,
        providerServiceId: offering.id,
      },
    });
    const proposal = await propose().expect(201),
      addOnId = (proposal.body as { data: { id: string } }).data.id;
    await client()
      .post(`/api/me/orders/${id}/add-ons/${addOnId}/decision`)
      .set('Authorization', auth(u.token))
      .send({ approve: true })
      .expect(200);
    expect(
      (await c.prisma.walletHold.findUniqueOrThrow({ where: { orderId: id } }))
        .amount,
    ).toBe(25_000);
  });

  it('reads member GPS before taking SQL locks when creating and accepting ASAP orders', async () => {
    const f = await worker(),
      u = await customer();
    await enable(f);
    const real = c.cache.getMemberPosition.bind(c.cache);
    const spy = jest
      .spyOn(c.cache, 'getMemberPosition')
      .mockImplementation(async (...args) => {
        await c.prisma.providerMember.update({
          where: { id: f.member.id },
          data: { displayName: 'GPS outside transaction' },
        });
        return real(...args);
      });
    try {
      const dto = {
          ...body(f, u),
          bookingType: 'ASAP' as const,
          scheduledAt: undefined,
        },
        q = await quote(u, dto).expect(200);
      const created = await client()
        .post('/api/orders')
        .set('Authorization', auth(u.token))
        .set('Idempotency-Key', randomUUID())
        .send({ ...dto, quoteToken: (q.body as QuoteResponse).data.quoteToken })
        .expect(201);
      await accept(f, (created.body as OrderResponse).data.id).expect(200);
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('settles stale orders atomically without releasing an in-progress dispute hold', async () => {
    const staffKey = randomUUID();
    const staff = await c.prisma.internalAccount.create({
      data: {
        username: `stale.${staffKey}`,
        normalizedUsername: `stale.${staffKey}`,
        fullName: 'Support test',
        status: 'ACTIVE',
      },
    });
    const f = await worker();
    const u = await customer();
    const cancelled = await book(f, u);
    await accept(f, cancelled.id).expect(200);
    const cancelAlert = await c.prisma.orderOperationalAlert.create({
      data: { orderId: cancelled.id, type: 'ACCEPTED_START_OVERDUE' },
    });
    await c.app
      .get(OrderCancellationService)
      .supportCancelStale(staff.id, cancelAlert.id, 'Không thể tiếp tục', {});
    const cancelledState = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: cancelled.id },
      include: { walletHold: true, calendarBlock: true },
    });
    expect(cancelledState.status).toBe('CANCELLED');
    expect(cancelledState.walletHold?.status).toBe('RELEASED');
    expect(cancelledState.calendarBlock?.active).toBe(false);
    expect(
      (
        await c.prisma.orderOperationalAlert.findUniqueOrThrow({
          where: { id: cancelAlert.id },
        })
      ).status,
    ).toBe('RESOLVED');

    const disputed = await book(f, u, future(180));
    await accept(f, disputed.id).expect(200);
    await c.prisma.serviceOrder.update({
      where: { id: disputed.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    const holdBefore = await c.prisma.walletHold.findUniqueOrThrow({
      where: { orderId: disputed.id },
    });
    const disputeAlert = await c.prisma.orderOperationalAlert.create({
      data: { orderId: disputed.id, type: 'SERVICE_COMPLETION_OVERDUE' },
    });
    await c.app
      .get(OrderPaymentDisputeService)
      .escalateStaleOrder(staff.id, disputeAlert.id, 'Cần đối soát', {});
    const disputeState = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: disputed.id },
      include: { walletHold: true, calendarBlock: true },
    });
    expect(disputeState.status).toBe('PAYMENT_DISPUTE');
    expect(disputeState.walletHold?.status).toBe('ACTIVE');
    expect(disputeState.walletHold?.amount).toBe(holdBefore.amount);
    expect(disputeState.calendarBlock?.active).toBe(false);
    await expect(
      c.app
        .get(OrderPaymentDisputeService)
        .escalateStaleOrder(staff.id, disputeAlert.id, 'Thử lại', {}),
    ).rejects.toThrow();
  });
});
