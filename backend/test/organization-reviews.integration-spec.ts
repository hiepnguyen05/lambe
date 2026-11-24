import { randomUUID } from 'node:crypto';
import type { Prisma, ServiceOrder } from '@prisma/client';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestUser } from './support/provider-members.fixture';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface Review {
  id: string;
  rating: number;
  comment: string | null;
  assignedMember: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}
interface ReviewPage {
  count: number;
  averageRating: number | null;
  reviews: Review[];
  nextCursor: string | null;
}
interface Envelope<T> {
  data: T;
}

describe('organization reviews — real HTTP authorization, PostgreSQL and Redis', () => {
  let c: Context;
  const client = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const fixture = () => memberCapabilitiesFixture(c);
  const colleague = (f: Worker) =>
    memberCapabilitiesFixture(c, { owner: f.owner, provider: f.provider });
  const providerPath = (f: Worker) => `/api/providers/${f.provider.id}/reviews`;
  const memberPath = (f: Worker) =>
    `/api/providers/${f.provider.id}/members/${f.member.id}/reviews`;
  const rate = (o: ServiceOrder, token: string, body: object = { rating: 5 }) =>
    client()
      .post(`/api/me/orders/${o.id}/review`)
      .set('Authorization', auth(token))
      .send(body);
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
  });
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  async function order(
    f: Worker,
    changes: Partial<Prisma.ServiceOrderUncheckedCreateInput> = {},
  ) {
    const customer = await memberTestUser(c.prisma, c.jwt);
    const at = new Date('2026-10-20T06:00:00Z');
    const o = await c.prisma.serviceOrder.create({
      data: {
        customerId: customer.id,
        providerId: f.provider.id,
        providerServiceId: f.offering.id,
        assignedMemberId: f.member.id,
        assignedMemberVersion: 1,
        assignedMemberUserId: f.worker.id,
        assignedMemberName: 'Historical stylist',
        assignedMemberAvatarUrl: 'https://example.com/historical-avatar.png',
        providerDisplayName: 'Historical organization',
        bookingType: 'SCHEDULED',
        status: 'COMPLETED',
        completedAt: at,
        expectedStartAt: at,
        expectedEndAt: new Date(at.getTime() + 3600000),
        serviceName: 'Review service',
        servicePriceAmount: 150000,
        subtotalAmount: 150000,
        totalAmount: 150000,
        durationMinutes: 60,
        commissionRateBps: 1000,
        commissionAmount: 15000,
        addressLabel: 'Private home',
        addressLine: 'DO NOT EXPOSE CUSTOMER ADDRESS',
        addressLatitude: 21.0285,
        addressLongitude: 105.8542,
        contactPhone: customer.phone,
        providerResponseDeadlineAt: new Date(at.getTime() - 600000),
        ...changes,
      },
    });
    return { o, customer };
  }

  it('stores one review and derives both scores from the immutable assignment, with transactional audit', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    const response = await rate(o, customer.token, {
      rating: 4,
      comment: '  Cẩn thận, đúng giờ.  ',
    }).expect(201);
    const review = (response.body as Envelope<Review>).data;
    expect(review).toMatchObject({
      rating: 4,
      comment: 'Cẩn thận, đúng giờ.',
      assignedMember: {
        id: f.member.id,
        displayName: 'Historical stylist',
        avatarUrl: o.assignedMemberAvatarUrl,
      },
    });
    expect(
      await c.prisma.orderReview.findUniqueOrThrow({
        where: { orderId: o.id },
      }),
    ).toMatchObject({
      memberId: f.member.id,
      membershipVersion: 1,
      customerId: customer.id,
      providerId: f.provider.id,
    });
    for (const path of [providerPath(f), memberPath(f)]) {
      expect((await client().get(path).expect(200)).body).toMatchObject({
        data: { count: 1, averageRating: 4, reviews: [{ id: review.id }] },
      });
    }
    expect(
      await c.prisma.auditLog.count({
        where: {
          action: 'ORDER_REVIEW_CREATED',
          resourceId: o.id,
          actorUserId: customer.id,
        },
      }),
    ).toBe(1);
    const detail = await client()
      .get(`/api/me/orders/${o.id}`)
      .set('Authorization', auth(customer.token))
      .expect(200);
    expect(detail.body).toMatchObject({ data: { review } });
  });

  it('rolls back the rating when the audit write fails', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    const spy = jest
      .spyOn(c.audit, 'record')
      .mockRejectedValueOnce(new Error('Simulated audit failure'));
    try {
      await rate(o, customer.token).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      0,
    );
    await rate(o, customer.token).expect(201);
  });

  it('allows only the owning customer; owner, assigned worker and another customer cannot review', async () => {
    const f = await fixture(),
      { o } = await order(f),
      outsider = await memberTestUser(c.prisma, c.jwt);
    await client()
      .post(`/api/me/orders/${o.id}/review`)
      .send({ rating: 5 })
      .expect(401);
    for (const token of [f.owner.token, f.worker.token, outsider.token])
      await rate(o, token).expect(404);
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      0,
    );
  });

  it.each([
    'PENDING_PROVIDER',
    'ACCEPTED',
    'IN_PROGRESS',
    'CANCELLED',
    'REJECTED',
    'PAYMENT_DISPUTE',
  ] as const)('rejects reviews for %s orders', async (status) => {
    const f = await fixture(),
      { o, customer } = await order(f, { status, completedAt: null });
    await rate(o, customer.token).expect(409);
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      0,
    );
  });

  it('permits exactly one concurrent review and one audit event', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    const responses = await Promise.all([
      rate(o, customer.token, { rating: 2 }),
      rate(o, customer.token, { rating: 5 }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    await rate(o, customer.token).expect(409);
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      1,
    );
    expect(
      await c.prisma.auditLog.count({
        where: { action: 'ORDER_REVIEW_CREATED', resourceId: o.id },
      }),
    ).toBe(1);
  });

  it('validates ratings/comments and forbids client-controlled attribution', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    for (const body of [
      { rating: 0 },
      { rating: 6 },
      { rating: 1.5 },
      { rating: '5' },
      { rating: 5, comment: 'x'.repeat(1001) },
      { rating: 5, memberId: f.member.id },
      { rating: 5, providerId: f.provider.id },
      { rating: 5, membershipVersion: 2 },
      { rating: 5, customerId: customer.id },
    ]) {
      await rate(o, customer.token, body).expect(400);
    }
    for (const rating of [1, 5]) {
      const next = await order(f);
      await rate(next.o, next.customer.token, { rating }).expect(201);
    }
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      0,
    );
  });

  it('isolates colleague scores while organization scores count each order once', async () => {
    const a = await fixture(),
      b = await colleague(a),
      other = await fixture();
    for (const [f, rating] of [
      [a, 5],
      [a, 3],
      [b, 1],
      [other, 5],
    ] as const) {
      const { o, customer } = await order(f);
      await rate(o, customer.token, { rating }).expect(201);
    }
    expect(
      (await client().get(providerPath(a)).expect(200)).body,
    ).toMatchObject({ data: { count: 3, averageRating: 3 } });
    expect((await client().get(memberPath(a)).expect(200)).body).toMatchObject({
      data: { count: 2, averageRating: 4 },
    });
    expect((await client().get(memberPath(b)).expect(200)).body).toMatchObject({
      data: { count: 1, averageRating: 1 },
    });
    await client()
      .get(`/api/providers/${other.provider.id}/members/${a.member.id}/reviews`)
      .expect(404);
  });

  it('keeps legacy reviews unattributed and never grants their points to the current roster', async () => {
    const f = await fixture(),
      { o, customer } = await order(f, {
        assignedMemberId: null,
        assignedMemberVersion: null,
        assignedMemberUserId: null,
        assignedMemberName: null,
        assignedMemberAvatarUrl: null,
      });
    expect(
      (await rate(o, customer.token, { rating: 3 }).expect(201)).body,
    ).toMatchObject({ data: { assignedMember: null } });
    expect(
      (await client().get(providerPath(f)).expect(200)).body,
    ).toMatchObject({ data: { count: 1, averageRating: 3 } });
    expect((await client().get(memberPath(f)).expect(200)).body).toMatchObject({
      data: { count: 0, averageRating: null, reviews: [] },
    });
  });

  it('retains the actual worker snapshot and reputation through renaming, leaving and rejoining', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: {
        displayName: 'Changed current name',
        avatarUrl: 'https://example.com/new.png',
        status: 'LEFT',
        leftAt: new Date(),
      },
    });
    await rate(o, customer.token, { rating: 2 }).expect(201);
    expect((await client().get(memberPath(f)).expect(200)).body).toMatchObject({
      data: { count: 1, averageRating: 2 },
    });
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'ACTIVE', leftAt: null, membershipVersion: 2 },
    });
    const next = await order(f, {
      assignedMemberVersion: 2,
      assignedMemberName: 'Second period name',
    });
    await rate(next.o, next.customer.token, { rating: 4 }).expect(201);
    const page = (await client().get(memberPath(f)).expect(200))
      .body as Envelope<ReviewPage>;
    expect(page.data).toMatchObject({ count: 2, averageRating: 3 });
    expect(
      page.data.reviews.find((r) => r.rating === 2)?.assignedMember
        ?.displayName,
    ).toBe('Historical stylist');
    expect(
      await c.prisma.orderReview.findUniqueOrThrow({
        where: { orderId: o.id },
      }),
    ).toMatchObject({ membershipVersion: 1 });
  });

  it('paginates equal timestamps deterministically without crossing provider/member scope', async () => {
    const f = await fixture(),
      b = await colleague(f),
      ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { o, customer } = await order(f);
      ids.push(
        ((await rate(o, customer.token).expect(201)).body as Envelope<Review>)
          .data.id,
      );
    }
    await c.prisma.orderReview.updateMany({
      where: { id: { in: ids } },
      data: { createdAt: new Date('2026-10-21T01:00:00Z') },
    });
    const first = (
      (await client().get(memberPath(f)).query({ limit: 2 }).expect(200))
        .body as Envelope<ReviewPage>
    ).data;
    const second = (
      (
        await client()
          .get(memberPath(f))
          .query({ limit: 2, cursor: first.nextCursor })
          .expect(200)
      ).body as Envelope<ReviewPage>
    ).data;
    expect(first.count).toBe(4);
    expect(second.count).toBe(4);
    expect(second.nextCursor).toBeNull();
    expect([...first.reviews, ...second.reviews].map((r) => r.id)).toEqual(
      ids.sort().reverse(),
    );
    await client()
      .get(memberPath(b))
      .query({ cursor: first.reviews[0].id })
      .expect(400);
    const foreign = await fixture();
    await client()
      .get(providerPath(foreign))
      .query({ cursor: first.reviews[0].id })
      .expect(400);
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { cursor: 'sql-injection' },
      { cursor: randomUUID() },
    ])
      await client().get(providerPath(f)).query(query).expect(400);
    await client().get('/api/providers/not-a-uuid/reviews').expect(400);
    await client().get(`/api/providers/${randomUUID()}/reviews`).expect(404);
  });

  it('never returns order/customer identity, contacts, addresses, GPS or KYC in public reviews', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    await rate(o, customer.token).expect(201);
    const page = (
      (await client().get(memberPath(f)).expect(200))
        .body as Envelope<ReviewPage>
    ).data;
    expect(Object.keys(page.reviews[0]).sort()).toEqual([
      'assignedMember',
      'comment',
      'createdAt',
      'id',
      'rating',
    ]);
    expect(Object.keys(page.reviews[0].assignedMember!).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'id',
    ]);
    expect(JSON.stringify(page)).not.toContain(customer.id);
    expect(JSON.stringify(page)).not.toContain(customer.phone);
    expect(JSON.stringify(page)).not.toContain(o.id);
    expect(JSON.stringify(page)).not.toContain(o.addressLine);
  });

  it('shows real worker scores on public member profiles and discovery with one batched aggregate', async () => {
    const f = await fixture(),
      { o, customer } = await order(f);
    await rate(o, customer.token, { rating: 4 }).expect(201);
    const batch = jest.spyOn(c.prisma.orderReview, 'groupBy');
    try {
      const member = await client()
        .get(`/api/providers/${f.provider.id}/members/${f.member.id}`)
        .expect(200);
      expect(member.body).toMatchObject({
        data: { reviewSummary: { count: 1, averageRating: 4 } },
      });
      expect(batch).toHaveBeenCalledTimes(1);
      batch.mockClear();
      const at = new Date(Date.now() + 2 * 86400000);
      at.setUTCMinutes(0, 0, 0);
      const response = await client()
        .post('/api/discovery/providers/search')
        .set('Authorization', auth(customer.token))
        .send({
          serviceId: f.catalog.id,
          providerId: f.provider.id,
          bookingType: 'SCHEDULED',
          scheduledAt: at.toISOString(),
          latitude: 21.0285,
          longitude: 105.8542,
          radiusKm: 10,
        })
        .expect(200);
      expect(response.body).toMatchObject({
        data: [
          expect.objectContaining({
            memberId: f.member.id,
            reviewSummary: { count: 1, averageRating: 4 },
          }),
        ],
      });
      expect(batch).toHaveBeenCalledTimes(1);
    } finally {
      batch.mockRestore();
    }
  });

  it('returns null, never fabricated five stars, for an unrated public provider profile', async () => {
    const f = await fixture();
    expect(
      (await client().get(`/api/providers/${f.provider.id}/public`).expect(200))
        .body,
    ).toMatchObject({ data: { stats: { rating: null, reviewCount: 0 } } });
  });

  it('rejects forged attribution and incomplete orders even when writes bypass the service', async () => {
    const f = await fixture(),
      b = await colleague(f),
      { o } = await order(f);
    const base = {
      orderId: o.id,
      providerId: f.provider.id,
      customerId: o.customerId,
      memberId: f.member.id,
      membershipVersion: 1,
      memberDisplayName: o.assignedMemberName,
      memberAvatarUrl: o.assignedMemberAvatarUrl,
      rating: 5,
    };
    for (const changes of [
      { providerId: randomUUID() },
      { customerId: b.worker.id },
      { memberId: b.member.id },
      { membershipVersion: 2 },
      { memberDisplayName: 'Forged name' },
      { memberAvatarUrl: null },
      {
        memberId: null,
        membershipVersion: null,
        memberDisplayName: null,
        memberAvatarUrl: null,
      },
    ]) {
      await expect(
        c.prisma.orderReview.create({ data: { ...base, ...changes } }),
      ).rejects.toThrow('Review must match its completed order');
    }
    const unfinished = await order(f, {
      status: 'IN_PROGRESS',
      completedAt: null,
    });
    await expect(
      c.prisma.orderReview.create({
        data: {
          ...base,
          orderId: unfinished.o.id,
          customerId: unfinished.customer.id,
        },
      }),
    ).rejects.toThrow('Review must match its completed order');
    const saved = await c.prisma.orderReview.create({ data: base });
    await expect(
      c.prisma.orderReview.update({
        where: { id: saved.id },
        data: { memberId: b.member.id },
      }),
    ).rejects.toThrow('Review attribution is immutable');
    expect(await c.prisma.orderReview.count({ where: { orderId: o.id } })).toBe(
      1,
    );
  });
});
