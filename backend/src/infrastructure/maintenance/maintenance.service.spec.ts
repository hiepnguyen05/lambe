import { ServiceOrderStatus, WalletTopUpStatus } from '@prisma/client';
import { PrismaService } from '../persistence/postgres/prisma.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: jest.Mocked<PrismaService>;
  let queryLock: jest.Mock;
  let deleteSessions: jest.Mock;
  let deleteUserSessions: jest.Mock;
  let closeProviderSessions: jest.Mock;
  let expireOrders: jest.Mock;
  let createOrderHistory: jest.Mock;
  let createOrderNotifications: jest.Mock;
  let expireTopUps: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T03:00:00.000Z'));
    queryLock = jest.fn().mockResolvedValue([{ acquired: true }]);
    deleteSessions = jest.fn().mockResolvedValue({ count: 2 });
    deleteUserSessions = jest.fn().mockResolvedValue({ count: 3 });
    closeProviderSessions = jest.fn().mockResolvedValue({ count: 0 });
    expireOrders = jest.fn().mockResolvedValue({ count: 0 });
    createOrderHistory = jest.fn().mockResolvedValue({ count: 0 });
    createOrderNotifications = jest.fn().mockResolvedValue({ count: 4 });
    expireTopUps = jest.fn().mockResolvedValue({ count: 0 });
    const transaction = {
      $queryRaw: queryLock,
      internalSession: { deleteMany: deleteSessions },
      userSession: { deleteMany: deleteUserSessions },
      serviceOrder: {
        updateMany: expireOrders,
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            customerId: 'customer-1',
            provider: { userId: 'provider-1' },
          },
          {
            id: 'order-2',
            customerId: 'customer-2',
            provider: { userId: 'provider-2' },
          },
        ]),
      },
      orderNotification: {
        createMany: createOrderNotifications,
      },
      providerCalendarBlock: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderStatusHistory: { createMany: createOrderHistory },
      walletTopUpRequest: { updateMany: expireTopUps },
      orderCancellationRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(transaction),
      ),
      providerAvailabilitySession: { updateMany: closeProviderSessions },
      walletTopUpRequest: { updateMany: expireTopUps },
      orderCancellationRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    service = new MaintenanceService(prisma, {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as never);
  });

  afterEach(() => jest.useRealTimers());

  it('removes expired and sufficiently old consumed records under a database lock', async () => {
    await service.cleanupExpiredRecords();

    expect(queryLock).toHaveBeenCalledTimes(1);
    expect(deleteSessions).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: new Date('2026-09-25T03:00:00.000Z') } },
          { revokedAt: { lt: new Date('2026-09-18T03:00:00.000Z') } },
        ],
      },
    });
    expect(deleteUserSessions).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: new Date('2026-09-25T03:00:00.000Z') } },
          { revokedAt: { lt: new Date('2026-09-18T03:00:00.000Z') } },
        ],
      },
    });
  });

  it('does not delete when another application instance owns the lock', async () => {
    queryLock.mockResolvedValue([{ acquired: false }]);

    await service.cleanupExpiredRecords();

    expect(deleteSessions).not.toHaveBeenCalled();
    expect(deleteUserSessions).not.toHaveBeenCalled();
  });

  it('rethrows database failures so monitoring can detect the failed job', async () => {
    deleteSessions.mockRejectedValue(new Error('database offline'));

    await expect(service.cleanupExpiredRecords()).rejects.toThrow(
      'database offline',
    );
    expect(deleteSessions).toHaveBeenCalledTimes(1);
  });

  it('closes provider sessions whose heartbeat expired', async () => {
    closeProviderSessions.mockResolvedValue({ count: 1 });

    await service.closeStaleProviderSessions();

    expect(closeProviderSessions).toHaveBeenCalledWith({
      where: {
        endedAt: null,
        lastHeartbeatAt: { lt: new Date('2026-09-25T02:58:00.000Z') },
      },
      data: {
        endedAt: new Date('2026-09-25T03:00:00.000Z'),
        endReason: 'HEARTBEAT_EXPIRED',
      },
    });
  });

  it('expires pending service orders after their response deadline', async () => {
    queryLock.mockResolvedValue([{ id: 'order-1' }, { id: 'order-2' }]);

    await service.expirePendingServiceOrders();

    expect(expireOrders).toHaveBeenCalledWith({
      where: {
        id: { in: ['order-1', 'order-2'] },
        status: ServiceOrderStatus.PENDING_PROVIDER,
      },
      data: { status: ServiceOrderStatus.EXPIRED },
    });
    expect(createOrderHistory).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'order-1',
          fromStatus: ServiceOrderStatus.PENDING_PROVIDER,
          toStatus: ServiceOrderStatus.EXPIRED,
          reason: 'PROVIDER_RESPONSE_TIMEOUT',
        },
        {
          orderId: 'order-2',
          fromStatus: ServiceOrderStatus.PENDING_PROVIDER,
          toStatus: ServiceOrderStatus.EXPIRED,
          reason: 'PROVIDER_RESPONSE_TIMEOUT',
        },
      ],
    });
  });

  it('notifies both parties when stale cancellation requests reach support', async () => {
    queryLock.mockResolvedValue([
      { orderId: 'order-1' },
      { orderId: 'order-2' },
    ]);
    await service.escalateStaleCancellationRequests();
    expect(createOrderNotifications).toHaveBeenCalledWith({
      data: [
        {
          userId: 'customer-1',
          orderId: 'order-1',
          event: 'CANCELLATION_ESCALATED',
        },
        {
          userId: 'provider-1',
          orderId: 'order-1',
          event: 'CANCELLATION_ESCALATED',
        },
        {
          userId: 'customer-2',
          orderId: 'order-2',
          event: 'CANCELLATION_ESCALATED',
        },
        {
          userId: 'provider-2',
          orderId: 'order-2',
          event: 'CANCELLATION_ESCALATED',
        },
      ],
    });
  });

  it('expires unfinished wallet top-up requests', async () => {
    await service.expireWalletTopUps();

    expect(expireTopUps).toHaveBeenCalledWith({
      where: {
        status: {
          in: [WalletTopUpStatus.CREATED, WalletTopUpStatus.PENDING_PAYMENT],
        },
        expiresAt: { lt: new Date('2026-09-25T03:00:00.000Z') },
      },
      data: { status: WalletTopUpStatus.EXPIRED },
    });
  });
});
