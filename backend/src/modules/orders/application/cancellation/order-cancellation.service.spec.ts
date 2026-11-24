import { ServiceOrderStatus } from '@prisma/client';
import { OrderCancellationService } from './order-cancellation.service';

describe('OrderCancellationService support stale cancellation', () => {
  const order = {
    id: 'order-id',
    providerId: 'provider-id',
    assignedMemberId: null,
    customerId: 'customer-id',
    assignedMemberUserId: null,
    provider: { userId: 'provider-user-id' },
    status: ServiceOrderStatus.ARRIVED,
    cancellationRequest: null,
  };

  function fixture() {
    const tx = {
      orderOperationalAlert: {
        findUnique: jest.fn().mockResolvedValue({
          orderId: order.id,
          type: 'ARRIVAL_START_OVERDUE',
          status: 'OPEN',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({}),
      },
      voucherRedemption: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderNotification: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: order.id }]),
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
    };
    const wallet = { release: jest.fn().mockResolvedValue(undefined) };
    const calendar = {
      lockProvider: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new OrderCancellationService(
      prisma as never,
      wallet as never,
      calendar as never,
      audit as never,
    );
    return { service, tx, wallet, calendar, audit };
  }

  it('releases the hold and calendar, cancels the order and notifies both parties atomically', async () => {
    const { service, tx, wallet, calendar, audit } = fixture();
    await expect(
      service.supportCancelStale(
        'staff-id',
        'alert-id',
        'Không thể tiếp tục đơn',
        {},
      ),
    ).resolves.toEqual({
      success: true,
      data: { id: order.id, status: 'CANCELLED' },
    });
    expect(wallet.release).toHaveBeenCalledWith(
      tx,
      order,
      'SUPPORT_STALE_ORDER_CANCELLED',
    );
    expect(calendar.release).toHaveBeenCalledWith(tx, order.id);
    const [update] = tx.serviceOrder.update.mock.calls[0] as unknown as [
      { where: { id: string }; data: { status: string } },
    ];
    expect(update.where).toEqual({ id: order.id });
    expect(update.data.status).toBe('CANCELLED');
    expect(tx.orderNotification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'customer-id', orderId: order.id, event: 'ORDER_CANCELLED' },
        {
          userId: 'provider-user-id',
          orderId: order.id,
          event: 'ORDER_CANCELLED',
        },
      ],
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_STALE_CANCELLED' }),
      {},
      tx,
    );
  });

  it('refuses to cancel if the order has already moved to service in progress', async () => {
    const { service, tx, wallet } = fixture();
    tx.serviceOrder.findFirst.mockResolvedValue({
      ...order,
      status: ServiceOrderStatus.IN_PROGRESS,
    });
    await expect(
      service.supportCancelStale(
        'staff-id',
        'alert-id',
        'Không thể tiếp tục đơn',
        {},
      ),
    ).rejects.toThrow('Trạng thái đơn không còn phù hợp');
    expect(wallet.release).not.toHaveBeenCalled();
  });
});
