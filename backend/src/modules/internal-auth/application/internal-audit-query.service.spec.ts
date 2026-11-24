import { BadRequestException } from '@nestjs/common';
import { InternalAuditQueryService } from './internal-audit-query.service';

describe('InternalAuditQueryService', () => {
  it('never selects audit metadata, IP, or user agent', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const service = new InternalAuditQueryService(prisma as never);
    await service.list({ page: 1, limit: 20 });
    const calls = prisma.auditLog.findMany.mock.calls as unknown as Array<
      [{ select: Record<string, boolean> }]
    >;
    const query = calls[0][0];
    expect(query.select.metadata).toBeUndefined();
    expect(query.select.ipAddress).toBeUndefined();
    expect(query.select.userAgent).toBeUndefined();
  });

  it('rejects reversed date ranges', async () => {
    const service = new InternalAuditQueryService({} as never);
    await expect(
      service.list({
        page: 1,
        limit: 20,
        from: '2026-10-18',
        to: '2026-10-17',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters by audit result', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const service = new InternalAuditQueryService(prisma as never);
    await service.list({ page: 1, limit: 20, result: 'SUCCESS' });
    const calls = prisma.auditLog.findMany.mock.calls as unknown as Array<
      [{ where: { result?: string } }]
    >;
    expect(calls[0][0].where.result).toBe('SUCCESS');
  });
});
