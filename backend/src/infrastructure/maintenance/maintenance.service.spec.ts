import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../persistence/postgres/prisma.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: jest.Mocked<PrismaService>;
  let queryLock: jest.Mock;
  let deleteOtps: jest.Mock;
  let deleteSessions: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T03:00:00.000Z'));
    queryLock = jest.fn().mockResolvedValue([{ acquired: true }]);
    deleteOtps = jest.fn().mockResolvedValue({ count: 5 });
    deleteSessions = jest.fn().mockResolvedValue({ count: 2 });
    const transaction = {
      $queryRaw: queryLock,
      otpCode: { deleteMany: deleteOtps },
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
    expect(deleteOtps).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: new Date('2026-09-25T03:00:00.000Z') } },
          {
            isUsed: true,
            createdAt: { lt: new Date('2026-09-24T03:00:00.000Z') },
          },
        ],
      },
    });
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

    expect(deleteOtps).not.toHaveBeenCalled();
    expect(deleteSessions).not.toHaveBeenCalled();
  });

  it('rethrows database failures so monitoring can detect the failed job', async () => {
    deleteOtps.mockRejectedValue(new Error('database offline'));

    await expect(service.cleanupExpiredRecords()).rejects.toThrow(
      'database offline',
    );
    expect(deleteSessions).not.toHaveBeenCalled();
  });
});
