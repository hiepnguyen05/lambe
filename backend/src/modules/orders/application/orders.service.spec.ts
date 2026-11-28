import { OrdersService } from './orders.service';
import { ServiceOrderStatus } from '@prisma/client';
import { orderInclude } from './persistence/order.presenter';

describe('OrdersService read queries', () => {
  it('does not load wallet relations when listing customer orders', async () => {
    const prisma = {
      serviceOrder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.findMine('customer-id', {});

    const calls = prisma.serviceOrder.findMany.mock.calls as unknown as [
      {
        include: {
          provider: { select: { wallet?: boolean } };
          walletHold?: boolean;
          statusHistory: unknown;
        };
      },
    ][];
    const query = calls[0][0];
    expect(query.include.provider.select.wallet).toBeUndefined();
    expect(query.include.walletHold).toBeUndefined();
    expect(query.include.statusHistory).toBeDefined();
  });
});

describe('OrdersService status updates', () => {
  it('returns the saved order and new history without reloading the order', async () => {
    const tx = {
      serviceOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            providerId: 'provider-id',
            assignedMemberId: null,
            assignedMemberVersion: null,
            assignedMemberUserId: null,
          })
          .mockResolvedValueOnce({
            id: 'order-id',
            status: ServiceOrderStatus.ARRIVED,
            customerId: 'customer-id',
            cancellationRequest: null,
            evidence: [{ type: 'BEFORE_WORK' }],
            scheduledAt: null,
          }),
        update: jest.fn().mockResolvedValue({
          id: 'order-id',
          status: ServiceOrderStatus.IN_PROGRESS,
          customerId: 'customer-id',
          customer: {
            id: 'customer-id',
            fullName: 'Customer',
            phone: '0900',
          },
          provider: {
            id: 'provider-id',
            displayName: 'Provider',
            avatarUrl: null,
            serviceRadiusKm: 10,
          },
          statusHistory: [
            {
              id: 'history-id',
              fromStatus: ServiceOrderStatus.ARRIVED,
              toStatus: ServiceOrderStatus.IN_PROGRESS,
              reason: null,
              createdAt: new Date(),
            },
          ],
        }),
        findUniqueOrThrow: jest.fn(),
      },
      orderNotification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-id' }),
      },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({
          provider: {
            id: 'provider-id',
            status: 'ACTIVE',
            setupCompletedAt: new Date(),
            serviceRadiusKm: 10,
          },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const calendar = {
      lockProvider: jest.fn(),
      releaseExpired: jest.fn(),
    };
    const service = new OrdersService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      calendar as never,
      {} as never,
      {} as never,
    );

    const result = await service.start('provider-user', 'order-id', {});

    expect(result.data.status).toBe(ServiceOrderStatus.IN_PROGRESS);
    expect(result.data.statusHistory).toEqual([
      expect.objectContaining({
        fromStatus: ServiceOrderStatus.ARRIVED,
        toStatus: ServiceOrderStatus.IN_PROGRESS,
      }),
    ]);
    expect(tx.serviceOrder.findUniqueOrThrow).not.toHaveBeenCalled();
    const updateCalls = tx.serviceOrder.update.mock.calls as unknown as Array<
      [{ include: { statusHistory: unknown } }]
    >;
    expect(updateCalls[0][0].include.statusHistory).toEqual(
      orderInclude.statusHistory,
    );
  });
});
