import { InternalRole } from '@prisma/client';
import { AdminOrderQueryService } from './admin-order-query.service';

const admin = {
  accountId: 'admin-id',
  username: 'admin',
  roles: [InternalRole.ADMIN],
  sessionId: 'session-id',
};
const support = {
  ...admin,
  accountId: 'support-id',
  roles: [InternalRole.SUPPORT],
};

function fixture() {
  const prisma = {
    serviceOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    orderEvidence: { findFirst: jest.fn() },
    $transaction: jest.fn(async (queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const storage = {
    createPrivateDownloadUrl: jest
      .fn()
      .mockReturnValue('https://example.test/signed'),
  };
  const service = new AdminOrderQueryService(
    prisma as never,
    audit as never,
    storage as never,
  );
  return { service, prisma, audit, storage };
}

const order = {
  id: 'order-id',
  statusHistory: [
    {
      id: 'history-id',
      fromStatus: null,
      toStatus: 'ACCEPTED',
      reason: null,
      actorUserId: null,
      createdAt: new Date('2026-10-18T12:00:00Z'),
    },
  ],
  evidence: [
    {
      id: 'evidence-id',
      type: 'ARRIVAL',
      capturedAt: new Date('2026-10-18T12:01:00Z'),
    },
  ],
  cancellationRequest: null,
  contactAttempts: [],
  review: null,
};

describe('AdminOrderQueryService', () => {
  it('keeps contact and exact address fields out of support detail projection', async () => {
    const { service, prisma, audit } = fixture();
    prisma.serviceOrder.findUnique.mockResolvedValue(order);
    const result = await service.get('order-id', support, {});
    const calls = prisma.serviceOrder.findUnique.mock.calls as unknown as Array<
      [{ select: Record<string, unknown> }]
    >;
    expect(calls[0][0].select.contactPhone).toBeUndefined();
    expect(calls[0][0].select.addressLatitude).toBeUndefined();
    expect(calls[0][0].select.customer).toBeUndefined();
    expect(calls[0][0].select.commissionAmount).toBeUndefined();
    expect(result.data.timeline.map((event) => event.kind)).toEqual([
      'STATUS',
      'EVIDENCE',
    ]);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits admin access to full order contact information', async () => {
    const { service, prisma, audit } = fixture();
    prisma.serviceOrder.findUnique.mockResolvedValue(order);
    await service.get('order-id', admin, { requestId: 'request-id' });
    const calls = prisma.serviceOrder.findUnique.mock.calls as unknown as Array<
      [{ select: Record<string, unknown> }]
    >;
    expect(calls[0][0].select.contactPhone).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorInternalAccountId: 'admin-id',
        action: 'ORDER_CONTACT_VIEWED',
        resourceType: 'ServiceOrder',
        resourceId: 'order-id',
        result: 'SUCCESS',
      },
      { requestId: 'request-id' },
    );
  });

  it('never selects contact fields in list queries', async () => {
    const { service, prisma } = fixture();
    await service.list({ page: 1, limit: 20 });
    const calls = prisma.serviceOrder.findMany.mock.calls as unknown as Array<
      [{ select: Record<string, unknown> }]
    >;
    expect(calls[0][0].select.contactPhone).toBeUndefined();
    expect(calls[0][0].select.addressLine).toBeUndefined();
  });

  it('audits the issue of a signed evidence URL', async () => {
    const { service, prisma, audit, storage } = fixture();
    prisma.orderEvidence.findFirst.mockResolvedValue({
      id: 'evidence-id',
      type: 'ARRIVAL',
      capturedAt: new Date(),
      publicId: 'private-id',
      fileFormat: 'jpg',
    });
    const result = await service.evidenceUrl(
      'order-id',
      'evidence-id',
      admin,
      {},
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_EVIDENCE_VIEWED' }),
      {},
    );
    expect(storage.createPrivateDownloadUrl).toHaveBeenCalledWith(
      'private-id',
      'jpg',
    );
    expect(result.data.url).toBe('https://example.test/signed');
  });

  it('aggregates analytics KPIs, trends, and alerts without a 100-row cap', async () => {
    const { service, prisma } = fixture();
    (prisma.serviceOrder as Record<string, unknown>).groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        {
          status: 'COMPLETED',
          _count: { id: 120 },
          _sum: { totalAmount: 24_000_000 },
        },
        {
          status: 'IN_PROGRESS',
          _count: { id: 15 },
          _sum: { totalAmount: 3_000_000 },
        },
        {
          status: 'EXPIRED',
          _count: { id: 5 },
          _sum: { totalAmount: 1_000_000 },
        },
      ])
      .mockResolvedValueOnce([
        {
          status: 'COMPLETED',
          _count: { id: 80 },
          _sum: { totalAmount: 16_000_000 },
        },
        {
          status: 'CANCELLED',
          _count: { id: 20 },
          _sum: { totalAmount: 4_000_000 },
        },
      ])
      .mockResolvedValueOnce([
        { serviceName: 'Cắt tóc nữ', _count: { id: 140 } },
      ])
      .mockResolvedValueOnce([
        { serviceName: 'Cắt tóc nữ', _sum: { totalAmount: 24_000_000 } },
      ]);
    (prisma as Record<string, unknown>).providerProfile = {
      count: jest.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(7),
    };
    (prisma as Record<string, unknown>).orderOperationalAlert = {
      count: jest.fn().mockResolvedValue(3),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'alert-1',
          type: 'SAFETY_HOLD_STALE',
          status: 'OPEN',
          detectedAt: new Date('2026-11-28T07:00:00Z'),
          order: {
            id: 'order-1',
            serviceName: 'Cắt tóc nữ',
            providerDisplayName: 'Minh Anh',
          },
        },
      ]),
    };
    const vnNow = new Date(Date.now() + 7 * 60 * 60_000);
    const todayKey = `${vnNow.getUTCDate()}/${vnNow.getUTCMonth() + 1}`;
    (prisma as Record<string, unknown>).$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        { bucket: todayKey, orders: 140n, revenue: 24000000n },
      ])
      .mockResolvedValueOnce([
        { week_index: 1, customers: 10n, providers: 2n },
        { week_index: 2, customers: 12n, providers: 3n },
        { week_index: 3, customers: 8n, providers: 1n },
        { week_index: 4, customers: 15n, providers: 4n },
      ]);

    const result = await service.analytics('7d', admin);

    expect(result.success).toBe(true);
    expect(result.data.kpis).toMatchObject({
      gmv: 24_000_000,
      gmvGrowth: 50,
      totalBookings: 140,
      bookingGrowth: 40,
      completionRate: 86,
      activeProviders: 42,
      activeProvidersDelta: 7,
      urgentAlertsCount: 3,
    });
    expect(
      result.data.revenueTrend.find((p) => p.date === todayKey),
    ).toMatchObject({
      orders: 140,
      revenue: 24_000_000,
    });
    expect(
      result.data.statusDistribution.find((s) => s.status === 'DISPUTED')
        ?.count,
    ).toBe(0);
    expect(
      result.data.statusDistribution.find((s) => s.status === 'CANCELLED')
        ?.count,
    ).toBe(5);
    expect(result.data.categoryBreakdown[0]).toMatchObject({
      name: 'Cắt tóc nữ',
      orders: 140,
      revenue: 24_000_000,
    });
    expect(result.data.growthTrend.map((g) => g.newCustomers)).toEqual([
      10, 12, 8, 15,
    ]);
    expect(result.data.recentAlerts).toHaveLength(1);
  });
});
