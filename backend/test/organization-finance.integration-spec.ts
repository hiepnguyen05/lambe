import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type ServiceOrder } from '@prisma/client';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestUser } from './support/provider-members.fixture';
import { memberTestReviewer } from './support/member-verification.fixture';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
interface ReportBody {
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
}
interface PageBody {
  data: { items: Record<string, unknown>[]; nextCursor: string | null };
}

describe('organization finance — HTTP + PostgreSQL, real authorization and ledger', () => {
  let c: Context;
  const range = {
    from: '2026-10-01T00:00:00+07:00',
    to: '2026-11-01T00:00:00+07:00',
  };
  const at = new Date('2026-10-20T06:00:00Z');
  const ownerPath = '/api/me/provider/finance';
  const workerPath = (id: string) =>
    `/api/me/provider/memberships/${id}/collections`;
  const http = () => request(c.app.getHttpServer());
  const get = (
    path: string,
    token: string,
    query: Record<string, unknown> = range,
  ) => http().get(path).set('Authorization', `Bearer ${token}`).query(query);
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
  });
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  const fixture = () => memberCapabilitiesFixture(c);
  const colleague = (f: Worker) =>
    memberCapabilitiesFixture(c, { owner: f.owner, provider: f.provider });
  async function order(
    f: Worker,
    changes: Partial<Prisma.ServiceOrderUncheckedCreateInput> = {},
  ) {
    const customer = await memberTestUser(c.prisma, c.jwt);
    return c.prisma.serviceOrder.create({
      data: {
        customerId: customer.id,
        providerId: f.provider.id,
        providerServiceId: f.offering.id,
        assignedMemberId: f.member.id,
        assignedMemberVersion: 1,
        assignedMemberUserId: f.worker.id,
        assignedMemberName: 'Snapshot worker',
        assignedMemberAvatarUrl: null,
        providerDisplayName: 'Snapshot organization',
        providerAvatarUrl: null,
        bookingType: 'SCHEDULED',
        expectedStartAt: at,
        expectedEndAt: new Date(at.getTime() + 3600000),
        status: 'COMPLETED',
        completedAt: at,
        serviceName: 'Test beauty service',
        servicePriceAmount: 150000,
        subtotalAmount: 150000,
        totalAmount: 150000,
        durationMinutes: 60,
        commissionRateBps: 1000,
        commissionAmount: 15000,
        addressLabel: 'Private address',
        addressLine: 'DO NOT EXPOSE CUSTOMER ADDRESS',
        addressLatitude: 21.0285,
        addressLongitude: 105.8542,
        contactPhone: customer.phone,
        providerResponseDeadlineAt: new Date(at.getTime() - 600000),
        ...changes,
      },
    });
  }
  const receipt = (f: Worker, amount = 150000) => ({
    cashCollectedAmount: amount,
    cashCollectedAt: at,
    cashCollectedByUserId: f.worker.id,
  });
  async function ledger(f: Worker, o: ServiceOrder, reimbursement = 0) {
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.walletTransaction.createMany({
      data: [
        {
          walletId: wallet.id,
          orderId: o.id,
          type: 'COMMISSION',
          amount: o.commissionAmount,
          balanceBeforeAmount: 200000,
          balanceAfterAmount: 200000 - o.commissionAmount,
          heldBeforeAmount: o.commissionAmount,
          heldAfterAmount: 0,
          idempotencyKey: `order:${o.id}:commission`,
        },
        ...(reimbursement
          ? [
              {
                walletId: wallet.id,
                orderId: o.id,
                type: 'VOUCHER_REIMBURSEMENT' as const,
                amount: reimbursement,
                balanceBeforeAmount: 200000 - o.commissionAmount,
                balanceAfterAmount: 200000 - o.commissionAmount + reimbursement,
                heldBeforeAmount: 0,
                heldAfterAmount: 0,
                idempotencyKey: `order:${o.id}:voucher-reimbursement`,
              },
            ]
          : []),
        {
          walletId: wallet.id,
          orderId: o.id,
          type: 'HOLD',
          amount: o.commissionAmount,
          balanceBeforeAmount: 200000,
          balanceAfterAmount: 200000,
          heldBeforeAmount: 0,
          heldAfterAmount: o.commissionAmount,
          idempotencyKey: `finance-test:${randomUUID()}`,
        },
      ],
    });
  }

  it('requires user JWT on all five report routes', async () => {
    const id = randomUUID();
    for (const path of [
      `${ownerPath}/summary`,
      `${ownerPath}/members`,
      `${ownerPath}/orders`,
      `${workerPath(id)}/summary`,
      `${workerPath(id)}/orders`,
    ])
      await http().get(path).query(range).expect(401);
  });

  it('denies worker/customer access to organization finance and another worker’s collection history', async () => {
    const f = await fixture(),
      other = await colleague(f),
      customer = await memberTestUser(c.prisma, c.jwt);
    for (const route of ['summary', 'members', 'orders']) {
      await get(`${ownerPath}/${route}`, f.worker.token).expect(403);
      await get(`${ownerPath}/${route}`, customer.token).expect(403);
    }
    await get(`${workerPath(f.member.id)}/summary`, other.worker.token).expect(
      404,
    );
    await get(`${workerPath(f.member.id)}/orders`, f.owner.token).expect(404);
    await get('/api/me/provider/wallet', f.worker.token, {}).expect(404);
    await http()
      .post('/api/me/provider/wallet/top-ups/momo')
      .set('Authorization', `Bearer ${f.worker.token}`)
      .send({ amount: 100000 })
      .expect(404);
  });

  it('returns zero totals for an empty range and a separate organization wallet snapshot', async () => {
    const f = await fixture();
    const response = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((response.body as ReportBody).data).toMatchObject({
      completedOrderCount: 0,
      customerPayableAmount: 0,
      cashRecordedAmount: 0,
      netOrderProceedsAmount: 0,
      organizationWalletNow: { balanceAmount: 200000, heldAmount: 0 },
    });
    expect((response.body as ReportBody).meta).toMatchObject({
      toExclusive: true,
      basis: 'COMPLETED_AT',
      payrollIncluded: false,
    });
  });

  it('uses completedAt [from,to), excludes pending/cancelled orders, and keeps active holds outside period totals', async () => {
    const f = await fixture();
    await order(f, receipt(f));
    await order(f, { completedAt: new Date(range.to) });
    await order(f, {
      completedAt: new Date(new Date(range.from).getTime() - 1),
    });
    await order(f, { status: 'CANCELLED', completedAt: null });
    const pending = await order(f, { status: 'ACCEPTED', completedAt: null });
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.walletHold.create({
      data: { walletId: wallet.id, orderId: pending.id, amount: 15000 },
    });
    await c.prisma.providerWallet.update({
      where: { id: wallet.id },
      data: { heldAmount: 15000 },
    });
    const response = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((response.body as ReportBody).data).toMatchObject({
      completedOrderCount: 1,
      customerPayableAmount: 150000,
      cashRecordedAmount: 150000,
      commissionChargedAmount: 0,
      commissionDifferenceAmount: 15000,
      outstandingNow: { activeHoldCount: 1, activeCommissionHoldAmount: 15000 },
    });
  });

  it('sums actual commission/voucher ledger once, ignoring HOLD and top-ups as order proceeds', async () => {
    const f = await fixture();
    const platform = await order(f, {
      ...receipt(f, 130000),
      travelFeeAmount: 10000,
      subtotalAmount: 160000,
      discountAmount: 30000,
      platformFundedAmount: 30000,
      voucherIssuer: 'PLATFORM',
      totalAmount: 130000,
    });
    const provider = await order(f, {
      ...receipt(f, 130000),
      travelFeeAmount: 10000,
      subtotalAmount: 160000,
      discountAmount: 30000,
      providerFundedAmount: 30000,
      voucherIssuer: 'PROVIDER',
      totalAmount: 130000,
      commissionAmount: 12000,
    });
    await ledger(f, platform, 30000);
    await ledger(f, provider);
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TOP_UP',
        amount: 9000000,
        balanceBeforeAmount: 200000,
        balanceAfterAmount: 9200000,
        heldBeforeAmount: 0,
        heldAfterAmount: 0,
        idempotencyKey: `finance-topup:${randomUUID()}`,
      },
    });
    const response = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((response.body as ReportBody).data).toMatchObject({
      completedOrderCount: 2,
      customerPayableAmount: 260000,
      cashRecordedAmount: 260000,
      servicePriceAmount: 300000,
      travelFeeAmount: 20000,
      discountAmount: 60000,
      platformFundedAmount: 30000,
      providerFundedAmount: 30000,
      commissionChargedAmount: 27000,
      commissionDifferenceAmount: 0,
      platformReimbursedAmount: 30000,
      netOrderProceedsAmount: 263000,
    });
  });

  it('does not invent a cash receipt or collector for support-confirmed/legacy payments', async () => {
    const f = await fixture();
    const o = await order(f);
    await ledger(f, o);
    const summary = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((summary.body as ReportBody).data).toMatchObject({
      cashRecordedAmount: 0,
      cashUnverifiedOrderCount: 1,
      cashUnverifiedPayableAmount: 150000,
    });
    const response = await get(`${ownerPath}/orders`, f.owner.token).expect(
      200,
    );
    expect((response.body as PageBody).data.items[0].cashCollection).toEqual({
      status: 'UNVERIFIED',
      amount: null,
      collectedAt: null,
      collectorMemberId: null,
    });
  });

  it('reports accepted add-on value from the final order snapshot without counting pending offers', async () => {
    const f = await fixture();
    const o = await order(f, {
      ...receipt(f, 200000),
      totalAmount: 200000,
      subtotalAmount: 200000,
      commissionAmount: 20000,
    });
    await ledger(f, o);
    const addon = {
      orderId: o.id,
      providerServiceId: f.offering.id,
      serviceName: 'Extra work',
      priceAmount: 50000,
      durationMinutes: 30,
      commissionAmount: 5000,
      proposedTotalAmount: 200000,
      proposedEndAt: new Date(at.getTime() + 5400000),
      expiresAt: at,
    };
    await c.prisma.orderAddOn.createMany({
      data: [
        {
          ...addon,
          clientRequestId: randomUUID(),
          requestHash: randomUUID(),
          status: 'ACCEPTED',
          respondedAt: at,
        },
        {
          ...addon,
          priceAmount: 900000,
          clientRequestId: randomUUID(),
          requestHash: randomUUID(),
          status: 'PENDING',
        },
      ],
    });
    const response = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((response.body as ReportBody).data).toMatchObject({
      servicePriceAmount: 150000,
      addOnPriceAmount: 50000,
      serviceTotalAmount: 200000,
      customerPayableAmount: 200000,
      cashRecordedAmount: 200000,
      commissionChargedAmount: 20000,
    });
  });

  it('paginates snapshot groups by membership version, retaining an explicit legacy bucket', async () => {
    const f = await fixture();
    await order(f, receipt(f));
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { membershipVersion: 2, displayName: 'Changed public name' },
    });
    await order(f, {
      assignedMemberVersion: 2,
      assignedMemberName: 'New membership snapshot',
      ...receipt(f),
    });
    await order(f, {
      assignedMemberId: null,
      assignedMemberVersion: null,
      assignedMemberUserId: null,
      assignedMemberName: null,
    });
    let cursor: string | null = null;
    const items: Record<string, unknown>[] = [];
    do {
      const response = await get(`${ownerPath}/members`, f.owner.token, {
        ...range,
        limit: 1,
        ...(cursor ? { cursor } : {}),
      }).expect(200);
      const page: PageBody['data'] = (response.body as PageBody).data;
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.membershipVersion === 1)?.displayName).toBe(
      'Snapshot worker',
    );
    expect(items.find((i) => i.membershipVersion === 2)?.displayName).toBe(
      'New membership snapshot',
    );
    expect(items.find((i) => i.groupKey === 'LEGACY')).toMatchObject({
      memberId: null,
      attribution: 'LEGACY_UNASSIGNED',
    });
  });

  it('scopes owner member filters to its organization and keeps walletNow organization-wide', async () => {
    const f = await fixture(),
      second = await colleague(f),
      foreign = await fixture();
    await order(f, receipt(f));
    await order(second, receipt(second));
    const response = await get(`${ownerPath}/summary`, f.owner.token, {
      ...range,
      memberId: second.member.id,
    }).expect(200);
    expect((response.body as ReportBody).data.completedOrderCount).toBe(1);
    expect(
      (response.body as ReportBody).data.organizationWalletNow,
    ).toBeDefined();
    await get(`${ownerPath}/summary`, f.owner.token, {
      ...range,
      memberId: foreign.member.id,
    }).expect(404);
    await get(`${ownerPath}/orders`, f.owner.token, {
      ...range,
      memberId: foreign.member.id,
    }).expect(404);
  });

  it('uses stable completedAt/id cursors with ties and rejects foreign cursor objects', async () => {
    const f = await fixture(),
      foreign = await fixture();
    const a = await order(f),
      b = await order(f),
      outsider = await order(foreign);
    const first = await get(`${ownerPath}/orders`, f.owner.token, {
      ...range,
      limit: 1,
    }).expect(200);
    const firstPage = (first.body as PageBody).data;
    const second = await get(`${ownerPath}/orders`, f.owner.token, {
      ...range,
      limit: 1,
      cursor: firstPage.nextCursor,
    }).expect(200);
    const secondPage = (second.body as PageBody).data;
    expect(
      [firstPage.items[0].orderId, secondPage.items[0].orderId].sort(),
    ).toEqual([a.id, b.id].sort());
    expect(secondPage.nextCursor).toBeNull();
    await get(`${ownerPath}/orders`, f.owner.token, {
      ...range,
      cursor: outsider.id,
    }).expect(400);
  });

  it('redacts wallet, organization proceeds, customer PII and colleagues from worker reports', async () => {
    const f = await fixture(),
      second = await colleague(f);
    const mine = await order(f, receipt(f));
    await ledger(f, mine);
    await order(second, receipt(second));
    const summary = await get(
      `${workerPath(f.member.id)}/summary`,
      f.worker.token,
    ).expect(200);
    expect((summary.body as ReportBody).data).toMatchObject({
      completedOrderCount: 1,
      cashRecordedAmount: 150000,
      collectionPurpose: 'ON_BEHALF_OF_ORGANIZATION',
    });
    const rows = await get(
      `${workerPath(f.member.id)}/orders`,
      f.worker.token,
    ).expect(200);
    expect((rows.body as PageBody).data.items).toHaveLength(1);
    for (const data of [
      (summary.body as ReportBody).data,
      (rows.body as PageBody).data.items[0],
    ]) {
      for (const field of [
        'organizationWalletNow',
        'commissionChargedAmount',
        'commissionAmount',
        'platformReimbursedAmount',
        'netOrderProceedsAmount',
        'customerId',
        'contactPhone',
        'addressLine',
      ])
        expect(data).not.toHaveProperty(field);
    }
    expect(JSON.stringify(rows.body)).not.toContain(
      'DO NOT EXPOSE CUSTOMER ADDRESS',
    );
    await get(`${workerPath(f.member.id)}/summary`, f.worker.token, {
      ...range,
      memberId: second.member.id,
    }).expect(400);
  });

  it('retains own historical receipts after LEFT/SUSPENDED without granting a new user access', async () => {
    const f = await fixture();
    await order(f, receipt(f));
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'LEFT', leftAt: new Date() },
    });
    const response = await get(
      `${workerPath(f.member.id)}/summary`,
      f.worker.token,
    ).expect(200);
    expect((response.body as ReportBody).data.cashRecordedAmount).toBe(150000);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'SUSPENDED', leftAt: null, membershipVersion: 2 },
    });
    await get(`${workerPath(f.member.id)}/orders`, f.worker.token).expect(200);
    const other = await memberTestUser(c.prisma, c.jwt);
    await get(`${workerPath(f.member.id)}/orders`, other.token).expect(404);
  });

  it('rejects unbounded, reversed, malformed or injected query inputs', async () => {
    const f = await fixture();
    for (const query of [
      {},
      { from: range.from },
      { ...range, from: '2026-10-02' },
      { from: range.to, to: range.from },
      { from: '2026-01-01T00:00:00Z', to: range.to },
      { ...range, limit: 51 },
      { ...range, cursor: "' OR 1=1 --" },
      { ...range, providerId: f.provider.id },
    ])
      await get(`${ownerPath}/orders`, f.owner.token, query).expect(400);
    await get(`${ownerPath}/members`, f.owner.token, {
      ...range,
      cursor: 'LEGACY;DROP TABLE users',
    }).expect(400);
  });

  it('records a cash receipt and charges commission exactly once on concurrent real completion', async () => {
    const f = await fixture();
    const o = await order(f, { status: 'IN_PROGRESS', completedAt: null });
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.providerWallet.update({
      where: { id: wallet.id },
      data: { heldAmount: 15000 },
    });
    await c.prisma.walletHold.create({
      data: { walletId: wallet.id, orderId: o.id, amount: 15000 },
    });
    await c.prisma.orderEvidence.create({
      data: {
        orderId: o.id,
        type: 'AFTER_WORK',
        publicId: `test/finance/${randomUUID()}`,
        fileFormat: 'png',
        uploadedByUserId: f.worker.id,
      },
    });
    const complete = () =>
      http()
        .post(`/api/me/provider/orders/${o.id}/complete`)
        .set('Authorization', `Bearer ${f.worker.token}`)
        .send({ cashReceived: true });
    const outcomes = await Promise.all([complete(), complete()]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(saved.cashCollectedAmount).toBe(150000);
    expect(saved.cashCollectedByUserId).toBe(f.worker.id);
    expect(saved.cashCollectedAt).not.toBeNull();
    expect(
      await c.prisma.walletTransaction.count({
        where: { orderId: o.id, type: 'COMMISSION' },
      }),
    ).toBe(1);
    expect(
      (
        await c.prisma.providerWallet.findUniqueOrThrow({
          where: { id: wallet.id },
        })
      ).balanceAmount,
    ).toBe(185000);
    await expect(
      c.prisma.serviceOrder.update({
        where: { id: o.id },
        data: { cashCollectedByUserId: f.owner.id },
      }),
    ).rejects.toThrow();
    await expect(
      c.prisma.serviceOrder.update({
        where: { id: o.id },
        data: { cashCollectedAmount: 1 },
      }),
    ).rejects.toThrow();
  });

  it('rejects a forged cash collector at the database boundary and supports zero cash receipts', async () => {
    const f = await fixture();
    await expect(
      order(f, { ...receipt(f), cashCollectedByUserId: f.owner.id }),
    ).rejects.toThrow();
    const zero = await order(f, {
      ...receipt(f, 0),
      totalAmount: 0,
      discountAmount: 150000,
      platformFundedAmount: 150000,
    });
    const response = await get(`${ownerPath}/orders`, f.owner.token).expect(
      200,
    );
    expect(
      (response.body as PageBody).data.items.find((r) => r.orderId === zero.id)
        ?.cashCollection,
    ).toMatchObject({ status: 'RECORDED', amount: 0 });
  });

  it('permits financial history when organization receiving is paused/suspended, not a suspended owner membership', async () => {
    const f = await fixture();
    await order(f, receipt(f));
    await c.prisma.providerProfile.update({
      where: { id: f.provider.id },
      data: { status: 'SUSPENDED', acceptingMemberOrders: false },
    });
    await get(`${ownerPath}/summary`, f.owner.token).expect(200);
    const owner = await c.prisma.providerMember.findFirstOrThrow({
      where: { providerId: f.provider.id, role: 'OWNER' },
    });
    await c.prisma.providerMember.update({
      where: { id: owner.id },
      data: { status: 'SUSPENDED' },
    });
    await get(`${ownerPath}/summary`, f.owner.token).expect(403);
  });

  it('releases an assigned order hold on cancellation without treating it as completed revenue', async () => {
    const f = await fixture();
    const o = await order(f, { status: 'ACCEPTED', completedAt: null });
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.providerWallet.update({
      where: { id: wallet.id },
      data: { heldAmount: 15000 },
    });
    await c.prisma.walletHold.create({
      data: { walletId: wallet.id, orderId: o.id, amount: 15000 },
    });
    await http()
      .post(`/api/me/provider/orders/${o.id}/cancel`)
      .set('Authorization', `Bearer ${f.worker.token}`)
      .send({ reason: 'Sự cố di chuyển, chưa khởi hành' })
      .expect(200);
    const response = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((response.body as ReportBody).data).toMatchObject({
      completedOrderCount: 0,
      commissionChargedAmount: 0,
      outstandingNow: { activeHoldCount: 0, activeCommissionHoldAmount: 0 },
    });
    expect(
      await c.prisma.walletTransaction.count({
        where: { orderId: o.id, type: 'RELEASE' },
      }),
    ).toBe(1);
    expect(
      (
        await c.prisma.providerWallet.findUniqueOrThrow({
          where: { id: wallet.id },
        })
      ).balanceAmount,
    ).toBe(200000);
  });

  it('keeps unpaid commission on hold, then records support-confirmed payment without fabricating a collector', async () => {
    const f = await fixture();
    const o = await order(f, { status: 'IN_PROGRESS', completedAt: null });
    const wallet = await c.prisma.providerWallet.findUniqueOrThrow({
      where: { providerId: f.provider.id },
    });
    await c.prisma.providerWallet.update({
      where: { id: wallet.id },
      data: { heldAmount: 15000 },
    });
    await c.prisma.walletHold.create({
      data: { walletId: wallet.id, orderId: o.id, amount: 15000 },
    });
    await c.prisma.orderEvidence.create({
      data: {
        orderId: o.id,
        type: 'AFTER_WORK',
        publicId: `test/finance/${randomUUID()}`,
        fileFormat: 'png',
      },
    });
    await http()
      .post(`/api/me/provider/orders/${o.id}/payment-dispute`)
      .set('Authorization', `Bearer ${f.worker.token}`)
      .send({ reason: 'Khách chưa thanh toán tiền mặt cho chuyên viên' })
      .expect(200);
    const reviewer = await memberTestReviewer(
      c.prisma,
      new JwtService({
        secret: c.app
          .get(ConfigService)
          .getOrThrow<string>('internalAuth.jwtSecret'),
      }),
      'SUPPORT',
    );
    const decision = (value: string) =>
      http()
        .post(`/api/admin/orders/payment-disputes/${o.id}/decision`)
        .set('Authorization', `Bearer ${reviewer.token}`)
        .send({
          decision: value,
          note: 'Đã liên hệ và kiểm tra thông tin hai bên',
        });
    await decision('CONFIRM_UNPAID').expect(200);
    const pending = await get(`${ownerPath}/summary`, f.owner.token).expect(
      200,
    );
    expect((pending.body as ReportBody).data).toMatchObject({
      completedOrderCount: 0,
      commissionChargedAmount: 0,
      outstandingNow: {
        activeHoldCount: 1,
        activeCommissionHoldAmount: 15000,
        paymentDisputeCount: 1,
      },
    });
    await decision('CONFIRM_PAID').expect(200);
    await decision('CONFIRM_PAID').expect(409);
    const saved = await c.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(saved.cashCollectedAmount).toBeNull();
    expect(saved.cashCollectedByUserId).toBeNull();
    const currentRange = {
      from: new Date(Date.now() - 60000).toISOString(),
      to: new Date(Date.now() + 60000).toISOString(),
    };
    const settled = await get(
      `${ownerPath}/summary`,
      f.owner.token,
      currentRange,
    ).expect(200);
    expect((settled.body as ReportBody).data).toMatchObject({
      completedOrderCount: 1,
      commissionChargedAmount: 15000,
      cashRecordedAmount: 0,
      cashUnverifiedOrderCount: 1,
      outstandingNow: { activeHoldCount: 0, paymentDisputeCount: 0 },
    });
    expect(
      await c.prisma.walletTransaction.count({
        where: { orderId: o.id, type: 'COMMISSION' },
      }),
    ).toBe(1);
  });
});
