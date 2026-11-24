import { OrderNotificationsService } from './order-notifications.service';
import { orderNotificationScope } from './order-notification-recipient.policy';

describe('OrderNotificationsService', () => {
  it('labels the recipient role without exposing order ownership details', async () => {
    const prisma = {
      orderNotification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'notification-1',
            orderId: 'order-1',
            event: 'CANCELLATION_REQUESTED',
            readAt: null,
            createdAt: new Date(),
            order: {
              customerId: 'customer-1',
              provider: { userId: 'provider-1' },
            },
          },
        ]),
      },
    };
    const service = new OrderNotificationsService(prisma as never);

    const result = await service.list('customer-1');

    expect(result.data[0]).toMatchObject({
      id: 'notification-1',
      recipientRole: 'CUSTOMER',
    });
    expect(result.data[0]).not.toHaveProperty('order');
    const calls = prisma.orderNotification.findMany.mock.calls as unknown as [
      {
        where: { userId: string };
        select: { order: { select: object } };
      },
    ][];
    const query = calls[0][0];
    expect(query.where).toEqual(orderNotificationScope('customer-1'));
    expect(query.select.order).toEqual({ select: { customerId: true } });
  });

  it('labels provider notifications for the provider order screen', async () => {
    const prisma = {
      orderNotification: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'notification-2',
            orderId: 'order-1',
            event: 'ORDER_CANCELLED',
            readAt: null,
            createdAt: new Date(),
            order: {
              customerId: 'customer-1',
              provider: { userId: 'provider-1' },
            },
          },
        ]),
      },
    };
    const service = new OrderNotificationsService(prisma as never);

    const result = await service.list('provider-1');

    expect(result.data[0]).toMatchObject({
      id: 'notification-2',
      recipientRole: 'PROVIDER',
    });
  });

  it("paginates by creation time and id without mixing another user's notifications", async () => {
    const first = {
      id: 'first',
      orderId: 'order-1',
      event: 'ORDER_ACCEPTED',
      readAt: null,
      createdAt: new Date('2026-10-20T10:00:00.000Z'),
      order: { customerId: 'customer-1' },
    };
    const second = { ...first, id: 'second' };
    const prisma = {
      orderNotification: {
        findFirst: jest.fn().mockResolvedValue({ createdAt: first.createdAt }),
        findMany: jest
          .fn()
          .mockResolvedValue([second, { ...first, id: 'third' }]),
      },
    };
    const service = new OrderNotificationsService(prisma as never);

    const result = await service.list('customer-1', {
      cursor: first.id,
      limit: 1,
    });

    expect(prisma.orderNotification.findFirst).toHaveBeenCalledWith({
      where: { id: first.id, ...orderNotificationScope('customer-1') },
      select: { createdAt: true },
    });
    expect(prisma.orderNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...orderNotificationScope('customer-1'),
          OR: [
            { createdAt: { lt: first.createdAt } },
            { createdAt: first.createdAt, id: { lt: first.id } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 2,
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ nextCursor: 'second' });
  });

  it('rejects a cursor belonging to another user', async () => {
    const prisma = {
      orderNotification: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };
    const service = new OrderNotificationsService(prisma as never);

    await expect(
      service.list('customer-1', { cursor: 'other-notification' }),
    ).rejects.toThrow('Thông báo phân trang không hợp lệ.');
    expect(prisma.orderNotification.findMany).not.toHaveBeenCalled();
  });
});
