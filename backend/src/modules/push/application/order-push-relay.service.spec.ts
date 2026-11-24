/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { OrderPushRelayService } from './order-push-relay.service';
import { PushOutboxService } from './push-outbox.service';

describe('OrderPushRelayService', () => {
  it('enqueues a committed order notification and marks it processed together', async () => {
    const row = {
      id: 'notification-id',
      userId: 'provider-user',
      orderId: 'order-id',
      event: 'ORDER_REQUESTED',
      order: {
        customerId: 'customer-user',
        status: 'PENDING_PROVIDER',
        providerResponseDeadlineAt: new Date(Date.now() + 60_000),
        assignedMemberId: null,
        provider: {
          userId: 'provider-user',
          status: 'ACTIVE',
          user: { status: 'ACTIVE' },
        },
      },
    };
    const tx = {
      orderNotification: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      orderNotification: { findMany: jest.fn().mockResolvedValue([row]) },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (client: typeof tx) => Promise<unknown>) =>
          fn(tx),
        ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const relay = new OrderPushRelayService(
      prisma as unknown as PrismaService,
      outbox as unknown as PushOutboxService,
    );

    await relay.enqueuePending();

    expect(outbox.enqueue).toHaveBeenCalledWith(tx, {
      userId: 'provider-user',
      sourceId: 'notification-id',
      event: 'ORDER_REQUESTED',
      entityType: 'ORDER',
      entityId: 'order-id',
      recipientRole: 'PROVIDER',
    });
    expect(tx.orderNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-id', pushQueuedAt: null },
      data: { pushQueuedAt: expect.any(Date) },
    });
  });
});
