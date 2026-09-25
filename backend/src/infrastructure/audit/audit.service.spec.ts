import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('writes actor, request and event metadata through the default client', async () => {
    const auditLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
    };
    const service = new AuditService({ auditLog } as never);

    await service.record(
      {
        action: 'TEST_ACTION',
        resourceType: 'TestResource',
        result: 'SUCCESS',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        requestId: 'request-id',
      },
    );

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'TEST_ACTION',
        resourceType: 'TestResource',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        requestId: 'request-id',
      },
    });
  });

  it('uses the supplied transaction client', async () => {
    const defaultAuditLog = { create: jest.fn() };
    const transactionAuditLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-id' }),
    };
    const service = new AuditService({ auditLog: defaultAuditLog } as never);

    await service.record(
      {
        action: 'TRANSACTION_ACTION',
        resourceType: 'TestResource',
        result: 'SUCCESS',
      },
      {},
      { auditLog: transactionAuditLog } as never,
    );

    expect(transactionAuditLog.create).toHaveBeenCalledTimes(1);
    expect(defaultAuditLog.create).not.toHaveBeenCalled();
  });
});
