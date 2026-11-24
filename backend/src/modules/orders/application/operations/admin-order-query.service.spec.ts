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
});
