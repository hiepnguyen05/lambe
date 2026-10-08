import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerManagementQueryService } from './customer-management-query.service';

describe('CustomerManagementQueryService', () => {
  const customer = {
    id: 'customer-id',
    phone: '+84912345678',
    fullName: 'Nguyen Van A',
    roles: [{ role: 'CUSTOMER' }],
  };
  const request = { ipAddress: '127.0.0.1', requestId: 'request-id' };

  function context() {
    const user = {
      findMany: jest.fn().mockResolvedValue([customer]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(customer),
    };
    const auditLog = {
      findMany: jest.fn().mockResolvedValue([{ id: 'activity-id' }]),
      count: jest.fn().mockResolvedValue(1),
    };
    const providerApplication = {
      findMany: jest.fn().mockResolvedValue([{ id: 'application-id' }]),
    };
    const prisma = {
      user,
      auditLog,
      providerApplication,
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new CustomerManagementQueryService(
        prisma as never,
        audit as never,
      ),
      prisma,
      user,
      auditLog,
      providerApplication,
      audit,
    };
  }

  it('lists only customers and applies all supported filters', async () => {
    const { service, user } = context();
    const result = await service.findAll({
      search: ' Nguyen ',
      status: 'ACTIVE',
      gender: 'MALE',
      onboardingStatus: 'COMPLETED',
      providerStatus: 'ACTIVE',
      createdFrom: '2026-01-01T00:00:00.000Z',
      createdTo: '2026-12-31T23:59:59.999Z',
      page: 2,
      limit: 10,
    });

    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: { some: { role: 'CUSTOMER' } },
          status: 'ACTIVE',
          customerProfile: {
            is: { gender: 'MALE', onboardingStatus: 'COMPLETED' },
          },
          providerProfile: { is: { status: 'ACTIVE' } },
        }) as object,
        skip: 10,
        take: 10,
      }),
    );
    expect(result.data[0].roles).toEqual(['CUSTOMER']);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('rejects an inverted creation time range', async () => {
    const { service } = context();

    await expect(
      service.findAll({
        createdFrom: '2026-12-31T00:00:00.000Z',
        createdTo: '2026-01-01T00:00:00.000Z',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns detail and audits access without exposing Firebase identity', async () => {
    const { service, user, audit } = context();
    user.findFirst.mockResolvedValue({
      ...customer,
      customerAddresses: [],
      customerProfile: null,
      providerProfile: null,
    });

    const result = await service.findOne('customer-id', 'admin-id', request);

    expect(result.data.roles).toEqual(['CUSTOMER']);
    expect(user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'customer-id',
          roles: { some: { role: 'CUSTOMER' } },
        },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorInternalAccountId: 'admin-id',
        action: 'CUSTOMER_PROFILE_ACCESSED',
      }),
      request,
    );
  });

  it('returns not found for a non-customer account', async () => {
    const { service, user } = context();
    user.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('missing-id', 'admin-id', request),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates customer activity', async () => {
    const { service, auditLog } = context();

    const result = await service.findActivity('customer-id', {
      page: 2,
      limit: 5,
    });

    expect(auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta.totalPages).toBe(1);
  });

  it('returns only provider application summaries and audits access', async () => {
    const { service, providerApplication, audit } = context();

    const result = await service.findProviderApplications(
      'customer-id',
      'support-id',
      request,
    );

    expect(providerApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'customer-id' } }),
    );
    expect(result.data).toEqual([{ id: 'application-id' }]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CUSTOMER_PROVIDER_APPLICATIONS_ACCESSED',
      }),
      request,
    );
  });
});
