import { ServiceOrderStatus, WalletHoldStatus } from '@prisma/client';
import { OrderPaymentDisputeService } from './order-payment-dispute.service';

describe('OrderPaymentDisputeService stale order escalation', () => {
  it('opens a dispute and keeps the wallet hold intact', async () => {
    const tx = {
      orderOperationalAlert: {
        findUnique: jest.fn().mockResolvedValue({
          orderId: 'order-id',
          type: 'SERVICE_COMPLETION_OVERDUE',
          status: 'OPEN',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          providerId: 'provider-id',
          assignedMemberId: null,
        }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'order-id',
          status: ServiceOrderStatus.IN_PROGRESS,
          customerId: 'customer-id',
          assignedMemberUserId: null,
          provider: { userId: 'provider-user-id' },
          walletHold: { status: WalletHoldStatus.ACTIVE },
          cancellationRequest: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderNotification: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order-id' }]),
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
    };
    const calendar = {
      lockProvider: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };
    const wallet = { release: jest.fn(), capture: jest.fn() };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new OrderPaymentDisputeService(
      prisma as never,
      calendar as never,
      wallet as never,
      audit as never,
    );

    await expect(
      service.escalateStaleOrder(
        'staff-id',
        'alert-id',
        'Cần kiểm tra thanh toán',
        {},
      ),
    ).resolves.toEqual({
      success: true,
      data: { id: 'order-id', status: ServiceOrderStatus.PAYMENT_DISPUTE },
    });
    expect(tx.serviceOrder.update).toHaveBeenCalledTimes(1);
    expect(wallet.release).not.toHaveBeenCalled();
    expect(wallet.capture).not.toHaveBeenCalled();
    expect(calendar.release).toHaveBeenCalledWith(tx, 'order-id');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_STALE_DISPUTE_OPENED' }),
      {},
      tx,
    );
  });
});
