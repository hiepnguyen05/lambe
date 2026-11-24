import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceOrderStatus } from '@prisma/client';
import { OrderSafetyService } from './order-safety.service';

const order = {
  id: 'order-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  provider: { userId: 'worker-1' },
  status: ServiceOrderStatus.IN_PROGRESS as ServiceOrderStatus,
  walletHold: { status: 'ACTIVE', amount: 20000 },
};

function setup(
  current = order,
  incident: Record<string, unknown> | null = null,
) {
  const createdIncident = {
    id: 'incident-1',
    status: 'OPEN',
    createdAt: new Date(),
  };
  const closedIncident = {
    id: 'incident-1',
    orderId: 'order-1',
    status: 'CLOSED',
    closedAt: new Date(),
  };
  const tx = {
    $queryRaw: jest.fn(),
    serviceOrder: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: { OR?: unknown[] } }) =>
          where.OR && !['customer-1', 'worker-1'].includes(activeUser)
            ? null
            : current,
        ),
      update: jest.fn(),
    },
    orderSafetyIncident: {
      findUnique: jest
        .fn()
        .mockImplementation(({ select }: { select?: unknown }) =>
          select
            ? { orderId: 'order-1', order: { providerId: 'provider-1' } }
            : incident,
        ),
      create: jest.fn().mockResolvedValue(createdIncident),
      update: jest.fn().mockResolvedValue(closedIncident),
    },
    orderSafetyReport: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'report-1' }),
    },
    orderCancellationRequest: { updateMany: jest.fn() },
    orderNotification: { createMany: jest.fn() },
    voucherRedemption: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((fn: (arg: typeof tx) => unknown) => fn(tx)),
    serviceOrder: { findFirst: jest.fn().mockResolvedValue(current) },
    orderSafetyIncident: { findFirst: jest.fn() },
  };
  const calendar = { lockProvider: jest.fn(), release: jest.fn() };
  const wallet = { release: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new OrderSafetyService(
    prisma as never,
    calendar as never,
    wallet as never,
    audit as never,
  );
  let activeUser = 'worker-1';
  return {
    service,
    tx,
    prisma,
    calendar,
    wallet,
    audit,
    setUser: (id: string) => {
      activeUser = id;
    },
  };
}

describe('OrderSafetyService', () => {
  it('puts an active order on safety hold without settling the wallet', async () => {
    const { service, tx, wallet, calendar } = setup();

    const result = await service.raise(
      'worker-1',
      'order-1',
      { reason: 'THREAT' },
      {},
    );

    expect(result.data).toMatchObject({ id: 'incident-1', status: 'OPEN' });
    const updatedOrder = (
      tx.serviceOrder.update.mock.calls as unknown[][]
    )[0]?.[0];
    const createdCase = (
      tx.orderSafetyIncident.create.mock.calls as unknown[][]
    )[0]?.[0];
    expect(updatedOrder).toMatchObject({ data: { status: 'SAFETY_HOLD' } });
    expect(createdCase).toMatchObject({
      data: {
        reports: { create: { reporterId: 'worker-1', reason: 'THREAT' } },
      },
    });
    expect(wallet.release).not.toHaveBeenCalled();
    expect(calendar.release).not.toHaveBeenCalled();
  });

  it('returns the existing incident on retry without creating another report', async () => {
    const existing = {
      id: 'incident-1',
      status: 'OPEN',
      createdAt: new Date(),
    };
    const { service, tx } = setup(
      { ...order, status: ServiceOrderStatus.SAFETY_HOLD },
      existing,
    );
    tx.orderSafetyReport.findUnique.mockResolvedValue({ id: 'report-1' });

    await service.raise('customer-1', 'order-1', { reason: 'THREAT' }, {});

    expect(tx.orderSafetyIncident.create).not.toHaveBeenCalled();
    expect(tx.orderSafetyReport.create).not.toHaveBeenCalled();
    expect(tx.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('does not disclose or change an order for a nonparticipant', async () => {
    const { service, tx, setUser } = setup();
    setUser('stranger');
    await expect(
      service.raise('stranger', 'order-1', { reason: 'OTHER' }, {}),
    ).rejects.toThrow(NotFoundException);
    expect(tx.orderSafetyIncident.create).not.toHaveBeenCalled();
  });

  it('rejects SOS on a completed order', async () => {
    const { service } = setup({
      ...order,
      status: ServiceOrderStatus.COMPLETED,
    });
    await expect(
      service.raise('customer-1', 'order-1', { reason: 'THREAT' }, {}),
    ).rejects.toThrow(ConflictException);
  });

  it('closes a safety case and releases calendar, hold and voucher once', async () => {
    const existing = {
      id: 'incident-1',
      status: 'OPEN',
      createdAt: new Date(),
    };
    const { service, tx, wallet, calendar } = setup(
      { ...order, status: ServiceOrderStatus.SAFETY_HOLD },
      existing,
    );

    await service.close(
      'staff-1',
      'incident-1',
      { resolutionNote: 'Case reviewed' },
      {},
    );

    expect(wallet.release).toHaveBeenCalledTimes(1);
    expect(calendar.release).toHaveBeenCalledWith(tx, 'order-1');
    expect(tx.voucherRedemption.updateMany).toHaveBeenCalled();
    const updatedOrder = (
      tx.serviceOrder.update.mock.calls as unknown[][]
    )[0]?.[0];
    const closedCase = (
      tx.orderSafetyIncident.update.mock.calls as unknown[][]
    )[0]?.[0];
    expect(updatedOrder).toMatchObject({ data: { status: 'CANCELLED' } });
    expect(closedCase).toMatchObject({
      data: { status: 'CLOSED', closedById: 'staff-1' },
    });
  });
});
