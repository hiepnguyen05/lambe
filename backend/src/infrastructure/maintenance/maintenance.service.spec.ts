import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../persistence/postgres/prisma.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: jest.Mocked<PrismaService>;
  let queryLock: jest.Mock;
  let deleteSessions: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T03:00:00.000Z'));
    queryLock = jest.fn().mockResolvedValue([{ acquired: true }]);
    deleteSessions = jest.fn().mockResolvedValue({ count: 2 });
    const transaction = {
      $queryRaw: queryLock,
      internalSession: { deleteMany: deleteSessions },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(transaction),
      ),
    } as unknown as jest.Mocked<PrismaService>;
    service = new MaintenanceService(prisma);
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
});
