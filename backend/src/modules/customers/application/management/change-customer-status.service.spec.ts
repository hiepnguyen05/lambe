import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InternalRole, UserStatus } from '@prisma/client';
import { ChangeCustomerStatusService } from './change-customer-status.service';

describe('ChangeCustomerStatusService', () => {
  const request = { ipAddress: '127.0.0.1', requestId: 'request-id' };
  const updatedCustomer = {
    id: 'customer-id',
    status: UserStatus.BLOCKED,
    roles: [{ role: 'CUSTOMER' }],
  };

  function context() {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'customer-id' }]),
      user: {
        findFirst: jest.fn().mockResolvedValue({
          status: UserStatus.ACTIVE,
          providerProfile: { id: 'provider-id' },
        }),
        update: jest.fn().mockResolvedValue(updatedCustomer),
      },
      providerAvailabilitySession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(transaction),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const locations = { remove: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new ChangeCustomerStatusService(
        prisma as never,
        audit as never,
        locations as never,
      ),
      transaction,
      audit,
      locations,
    };
  }

  it('blocks a customer, closes provider sessions and removes live location', async () => {
    const { service, transaction, audit, locations } = context();
    const result = await service.execute(
      'customer-id',
      {
        status: UserStatus.BLOCKED,
        reason: 'Xác minh phản ánh từ khách hàng.',
      },
      'support-id',
      [InternalRole.SUPPORT],
      request,
    );

    expect(
      transaction.providerAvailabilitySession.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: 'provider-id', endedAt: null },
      }),
    );
    expect(locations.remove).toHaveBeenCalledWith('provider-id');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorInternalAccountId: 'support-id',
        action: 'CUSTOMER_STATUS_CHANGED',
        metadata: expect.objectContaining({
          from: UserStatus.ACTIVE,
          to: UserStatus.BLOCKED,
          closedProviderSessionCount: 1,
        }) as object,
      }),
      request,
      transaction,
    );
    expect(result.data.roles).toEqual(['CUSTOMER']);
  });

  it('does not fail the persisted status change when location cleanup fails', async () => {
    const { service, locations } = context();
    locations.remove.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.execute(
        'customer-id',
        {
          status: UserStatus.BLOCKED,
          reason: 'Khóa tài khoản trong lúc xác minh.',
        },
        'admin-id',
        [InternalRole.ADMIN],
        request,
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it('prevents support from setting the inactive status', async () => {
    const { service } = context();

    await expect(
      service.execute(
        'customer-id',
        {
          status: UserStatus.INACTIVE,
          reason: 'Ngừng tài khoản theo yêu cầu quản trị.',
        },
        'support-id',
        [InternalRole.SUPPORT],
        request,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found when the account is not a customer', async () => {
    const { service, transaction } = context();
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(
      service.execute(
        'missing-id',
        {
          status: UserStatus.BLOCKED,
          reason: 'Không tìm thấy tài khoản cần khóa.',
        },
        'admin-id',
        [InternalRole.ADMIN],
        request,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
