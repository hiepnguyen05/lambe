import {
  InternalRole,
  OrderOperationalAlertStatus,
  OrderOperationalAlertType,
} from '@prisma/client';
import { OrderOperationalAlertService } from './order-operational-alert.service';

const actor = {
  accountId: '11111111-1111-4111-8111-111111111111',
  username: 'support',
  roles: [InternalRole.SUPPORT],
  sessionId: 'session-id',
};

function fixture() {
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValueOnce([{ id: 'auto-resolved-alert' }])
    .mockResolvedValueOnce([
      { type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE },
      { type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE },
    ]);
  const transaction = {
    $queryRaw: queryRaw,
    orderOperationalAlert: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    internalAccount: { findMany: jest.fn().mockResolvedValue([]) },
    serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
    orderNotification: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(transaction),
    ),
    orderOperationalAlert: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const mail = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const service = new OrderOperationalAlertService(
    prisma as never,
    audit as never,
    mail as never,
  );
  return { service, prisma, transaction, queryRaw, audit, mail };
}

describe('OrderOperationalAlertService', () => {
  it('scans under one database lock and reports created and auto-resolved alerts', async () => {
    const { service, queryRaw } = fixture();

    await expect(service.scan()).resolves.toEqual({
      created: 2,
      autoResolved: 1,
    });
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('skips the scan when another application instance owns the lock', async () => {
    const { service, queryRaw } = fixture();
    queryRaw.mockReset().mockResolvedValue([{ acquired: false }]);

    await expect(service.scan()).resolves.toEqual({
      created: 0,
      autoResolved: 0,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('queues one email per active staff member and alert', async () => {
    const { service, queryRaw, transaction, mail } = fixture();
    queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'alert-id',
          orderId: 'order-id',
          type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE,
        },
      ]);
    transaction.internalAccount.findMany.mockResolvedValue([
      { id: 'staff-id', email: 'support@example.test' },
    ]);
    transaction.serviceOrder.findMany.mockResolvedValue([
      {
        id: 'order-id',
        customerId: 'customer-id',
        assignedMemberUserId: null,
        provider: { userId: 'provider-id' },
      },
    ]);

    await service.scan();

    expect(mail.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'support@example.test' }),
      'order-alert:alert-id:initial:staff-id',
      transaction,
    );
    expect(transaction.orderNotification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'customer-id', orderId: 'order-id', event: 'ORDER_DELAYED' },
        { userId: 'provider-id', orderId: 'order-id', event: 'ORDER_DELAYED' },
      ],
    });
  });

  it('acknowledges an alert and records the support action', async () => {
    const { service, transaction, audit } = fixture();
    transaction.orderOperationalAlert.findUnique.mockResolvedValue({
      status: OrderOperationalAlertStatus.OPEN,
    });
    transaction.orderOperationalAlert.findUniqueOrThrow.mockResolvedValue({
      id: 'alert-id',
      type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE,
      order: { id: 'order-id' },
    });

    await service.acknowledge('alert-id', actor, { requestId: 'request-id' });

    const [updateInput] = transaction.orderOperationalAlert.updateMany.mock
      .calls[0] as unknown as [
      {
        where: { id: string };
        data: { status: OrderOperationalAlertStatus; acknowledgedById: string };
      },
    ];
    expect(updateInput.where).toEqual({
      id: 'alert-id',
      status: OrderOperationalAlertStatus.OPEN,
    });
    expect(updateInput.data).toMatchObject({
      status: OrderOperationalAlertStatus.ACKNOWLEDGED,
      acknowledgedById: actor.accountId,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorInternalAccountId: actor.accountId,
        action: 'ORDER_OPERATIONAL_ALERT_ACKNOWLEDGED',
        resourceId: 'alert-id',
      }),
      { requestId: 'request-id' },
      transaction,
    );
  });

  it('rejects a concurrent acknowledgement without an audit entry', async () => {
    const { service, transaction, audit } = fixture();
    transaction.orderOperationalAlert.findUnique.mockResolvedValue({
      status: OrderOperationalAlertStatus.OPEN,
    });
    transaction.orderOperationalAlert.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.acknowledge('alert-id', actor, {})).rejects.toThrow(
      'Cảnh báo đã được người khác xử lý.',
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not let support hide an order that is still stuck', async () => {
    const { service, transaction, audit } = fixture();
    transaction.orderOperationalAlert.findUnique.mockResolvedValue({
      status: OrderOperationalAlertStatus.OPEN,
    });
    transaction.orderOperationalAlert.findUniqueOrThrow.mockResolvedValue({
      orderId: 'order-id',
      type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE,
      order: { status: 'ARRIVED' },
    });
    await expect(
      service.resolve('alert-id', 'Đã liên hệ', actor, {}),
    ).rejects.toThrow('Đơn vẫn đang ở trạng thái cần xử lý.');
    expect(transaction.orderOperationalAlert.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('batches initial and escalation outbox emails in one enqueueMany call', async () => {
    const { service, queryRaw, transaction, mail } = fixture();
    const enqueueMany = jest.fn().mockResolvedValue(2);
    (mail as Record<string, unknown>).enqueueMany = enqueueMany;
    queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'alert-new',
          orderId: 'order-1',
          type: OrderOperationalAlertType.ARRIVAL_START_OVERDUE,
        },
      ]);
    transaction.orderOperationalAlert.findMany.mockResolvedValue([
      {
        id: 'alert-stale',
        orderId: 'order-2',
        type: OrderOperationalAlertType.SAFETY_HOLD_STALE,
      },
    ]);
    transaction.internalAccount.findMany.mockResolvedValue([
      { id: 'staff-1', email: 'staff1@example.test' },
      { id: 'staff-2', email: 'staff2@example.test' },
    ]);
    transaction.serviceOrder.findMany.mockResolvedValue([
      {
        id: 'order-1',
        customerId: 'customer-id',
        assignedMemberUserId: null,
        provider: { userId: 'provider-id' },
      },
    ]);

    await service.scan();

    expect(enqueueMany).toHaveBeenCalledTimes(1);
    expect(mail.enqueue).not.toHaveBeenCalled();
    const [items] = enqueueMany.mock.calls[0] as [
      Array<{ deduplicationKey: string }>,
    ];
    expect(items.map((item) => item.deduplicationKey)).toEqual([
      'order-alert:alert-new:initial:staff-1',
      'order-alert:alert-new:initial:staff-2',
      'order-alert:alert-stale:escalation:staff-1',
      'order-alert:alert-stale:escalation:staff-2',
    ]);
  });
});
