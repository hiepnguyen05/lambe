import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../persistence/postgres/prisma.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: jest.Mocked<PrismaService>;
  let queryLock: jest.Mock;
  let deleteSessions: jest.Mock;
  let closeProviderSessions: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T03:00:00.000Z'));
    queryLock = jest.fn().mockResolvedValue([{ acquired: true }]);
    deleteSessions = jest.fn().mockResolvedValue({ count: 2 });
    closeProviderSessions = jest.fn().mockResolvedValue({ count: 0 });
    const transaction = {
      $queryRaw: queryLock,
      internalSession: { deleteMany: deleteSessions },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(transaction),
      ),
      providerAvailabilitySession: { updateMany: closeProviderSessions },
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
  });

  it('does not delete when another application instance owns the lock', async () => {
    queryLock.mockResolvedValue([{ acquired: false }]);

    await service.cleanupExpiredRecords();

    expect(deleteSessions).not.toHaveBeenCalled();
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
});
