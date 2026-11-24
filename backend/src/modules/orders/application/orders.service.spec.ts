import { OrdersService } from './orders.service';

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
