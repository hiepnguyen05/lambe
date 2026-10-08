import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProviderProfileStatus } from '@prisma/client';
import { AdminProviderStatusAction } from '../../dto/admin-provider-management.dto';
import { AdminProviderManagementService } from './admin-provider-management.service';

describe('AdminProviderManagementService', () => {
  const request = { ipAddress: '127.0.0.1', requestId: 'request-id' };

  function detail(status: ProviderProfileStatus) {
    return {
      id: 'provider-id',
      providerType: 'INDIVIDUAL',
      displayName: 'Nguyễn Văn An',
      avatarUrl: null,
      biography: null,
      experienceYears: 2,
      status,
      serviceAreaName: 'Quận 1',
      serviceAreaLatitude: 10.77,
      serviceAreaLongitude: 106.7,
      serviceRadiusKm: 10,
      setupCompletedAt: new Date('2026-10-01T00:00:00.000Z'),
      sourceApplicationId: 'application-id',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      user: {
        id: 'user-id',
        fullName: 'Nguyễn Văn An',
        phone: '0900000000',
        status: 'ACTIVE',
      },
      wallet: null,
      workingHours: [],
      services: [],
      availabilitySessions: [],
    };
  }

  function context() {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider-id' }]),
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProviderProfileStatus.ACTIVE,
          setupCompletedAt: new Date('2026-10-01T00:00:00.000Z'),
        }),
        update: jest
          .fn()
          .mockResolvedValue(detail(ProviderProfileStatus.SUSPENDED)),
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
      service: new AdminProviderManagementService(
        prisma as never,
        audit as never,
        locations as never,
      ),
      transaction,
      audit,
      locations,
    };
  }

  it('keeps the provider list in data and places summary inside meta', async () => {
    const prisma = {
      providerProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new AdminProviderManagementService(
      prisma as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
    );

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result).not.toHaveProperty('summary');
    expect(result.meta).toMatchObject({
      page: 1,
      total: 0,
      summary: {
        total: 0,
        setupRequired: 0,
        active: 0,
        suspended: 0,
        individuals: 0,
        organizations: 0,
      },
    });
  });

  it('suspends a provider, closes availability and removes live location', async () => {
    const { service, transaction, audit, locations } = context();

    const result = await service.updateStatus(
      'provider-id',
      {
        status: AdminProviderStatusAction.SUSPENDED,
        reason: 'Tạm dừng để xác minh phản ánh.',
      },
      'admin-id',
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
        action: 'PROVIDER_STATUS_CHANGED',
        metadata: expect.objectContaining({
          from: ProviderProfileStatus.ACTIVE,
          to: ProviderProfileStatus.SUSPENDED,
          closedSessionCount: 1,
        }) as object,
      }),
      request,
      transaction,
    );
    expect(result.data.status).toBe(ProviderProfileStatus.SUSPENDED);
  });

  it('restores an unfinished provider to setup required', async () => {
    const { service, transaction, locations } = context();
    transaction.providerProfile.findUnique.mockResolvedValue({
      status: ProviderProfileStatus.SUSPENDED,
      setupCompletedAt: null,
    });
    transaction.providerProfile.update.mockResolvedValue(
      detail(ProviderProfileStatus.SETUP_REQUIRED),
    );

    const result = await service.updateStatus(
      'provider-id',
      {
        status: AdminProviderStatusAction.ACTIVE,
        reason: 'Đã xác minh và cho phép tiếp tục thiết lập.',
      },
      'admin-id',
      request,
    );

    expect(transaction.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: ProviderProfileStatus.SETUP_REQUIRED },
      }),
    );
    expect(locations.remove).not.toHaveBeenCalled();
    expect(result.data.status).toBe(ProviderProfileStatus.SETUP_REQUIRED);
  });

  it('rejects activation when the provider is not suspended', async () => {
    const { service } = context();

    await expect(
      service.updateStatus(
        'provider-id',
        {
          status: AdminProviderStatusAction.ACTIVE,
          reason: 'Yêu cầu khôi phục không hợp lệ.',
        },
        'admin-id',
        request,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for a missing provider', async () => {
    const { service, transaction } = context();
    transaction.providerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus(
        'missing-id',
        {
          status: AdminProviderStatusAction.SUSPENDED,
          reason: 'Không tìm thấy hồ sơ cần đình chỉ.',
        },
        'admin-id',
        request,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
