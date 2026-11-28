import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ProviderProfileStatus, ProviderType } from '@prisma/client';
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
        avatarUrl: null,
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
    const mediaStorage = {
      publishPrivateImage: jest.fn(),
      deleteImage: jest.fn(),
    };
    return {
      service: new AdminProviderManagementService(
        prisma as never,
        audit as never,
        locations as never,
        mediaStorage as never,
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
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminProviderManagementService(
      prisma as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
      { publishPrivateImage: jest.fn(), deleteImage: jest.fn() } as never,
    );

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(prisma.providerProfile.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.providerProfile.groupBy).toHaveBeenCalledTimes(1);
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

  it('derives filtered pagination and search-wide summary from grouped counts', async () => {
    const groups = [
      {
        status: ProviderProfileStatus.SETUP_REQUIRED,
        providerType: ProviderType.INDIVIDUAL,
        _count: { _all: 2 },
      },
      {
        status: ProviderProfileStatus.ACTIVE,
        providerType: ProviderType.INDIVIDUAL,
        _count: { _all: 3 },
      },
      {
        status: ProviderProfileStatus.ACTIVE,
        providerType: ProviderType.ORGANIZATION,
        _count: { _all: 4 },
      },
      {
        status: ProviderProfileStatus.SUSPENDED,
        providerType: ProviderType.ORGANIZATION,
        _count: { _all: 5 },
      },
    ];
    let groupingWhere: Prisma.ProviderProfileWhereInput | undefined;
    const prisma = {
      providerProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn(
          (args: { where: Prisma.ProviderProfileWhereInput }) => {
            groupingWhere = args.where;
            return Promise.resolve(groups);
          },
        ),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new AdminProviderManagementService(
      prisma as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
      { publishPrivateImage: jest.fn(), deleteImage: jest.fn() } as never,
    );

    const result = await service.findAll({
      page: 2,
      limit: 3,
      search: '  An  ',
      status: ProviderProfileStatus.ACTIVE,
      providerType: ProviderType.ORGANIZATION,
    });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProviderProfileStatus.ACTIVE,
          providerType: ProviderType.ORGANIZATION,
        }) as object,
        skip: 3,
        take: 3,
      }),
    );
    expect(groupingWhere?.OR).toHaveLength(5);
    expect(groupingWhere?.status).toBeUndefined();
    expect(groupingWhere?.providerType).toBeUndefined();
    expect(result.meta).toMatchObject({
      total: 4,
      totalPages: 2,
      summary: {
        total: 14,
        setupRequired: 2,
        active: 7,
        suspended: 5,
        individuals: 5,
        organizations: 9,
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

  it('bounds avatar backfill, continues past invalid portraits and returns a resume cursor', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const providerProfile = {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(
          Array.from({ length: 25 }, (_, index) => ({
            id: `provider-${index}`,
            createdAt,
          })),
        )
        .mockResolvedValueOnce([
          { id: 'provider-25', createdAt },
          { id: 'provider-26', createdAt },
        ]),
    };
    const service = new AdminProviderManagementService(
      { providerProfile } as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
      { publishPrivateImage: jest.fn(), deleteImage: jest.fn() } as never,
    );
    const sync = jest.spyOn(service, 'syncAvatar').mockImplementation((id) => {
      if (id === 'provider-0')
        return Promise.reject(new BadRequestException('No portrait'));
      if (id === 'provider-1') return Promise.reject(new Error('private info'));
      return Promise.resolve({} as never);
    });

    await expect(
      service.backfillMissingAvatars({ limit: 27 }),
    ).resolves.toEqual({
      scanned: 27,
      updated: 25,
      skipped: 1,
      failed: 1,
      nextCursor: 'provider-26',
    });
    expect(sync).toHaveBeenCalledTimes(27);
    expect(providerProfile.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 2,
        where: {
          AND: [
            {
              OR: [{ avatarUrl: null }, { user: { is: { avatarUrl: null } } }],
            },
            {
              OR: [
                { createdAt: { gt: createdAt } },
                { createdAt, id: { gt: 'provider-24' } },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('resumes avatar backfill from a cursor and rejects unbounded limits', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const providerProfile = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ createdAt }),
    };
    const service = new AdminProviderManagementService(
      { providerProfile } as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
      { publishPrivateImage: jest.fn(), deleteImage: jest.fn() } as never,
    );

    await expect(
      service.backfillMissingAvatars({ limit: 501 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(providerProfile.findMany).not.toHaveBeenCalled();
    await expect(
      service.backfillMissingAvatars({ cursor: 'resume-id', limit: 1 }),
    ).resolves.toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      nextCursor: 'resume-id',
    });
    expect(providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { createdAt: { gt: createdAt } },
                { createdAt, id: { gt: 'resume-id' } },
              ],
            },
          ]) as object[],
        }) as object,
      }),
    );
  });

  it('does not replace an avatar published by another backfill while media was uploading', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider-id' }]),
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          avatarUrl: 'https://example.test/current.webp',
          user: { avatarUrl: 'https://example.test/current.webp' },
        }),
        update: jest
          .fn()
          .mockResolvedValue(detail(ProviderProfileStatus.ACTIVE)),
      },
      providerApplicationDocument: {
        findFirst: jest.fn().mockResolvedValue({ id: 'portrait-id' }),
      },
      user: { update: jest.fn() },
    };
    const prisma = {
      providerProfile: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'provider-id', createdAt }])
          .mockResolvedValueOnce([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'provider-id',
          userId: 'user-id',
          sourceApplicationId: 'application-id',
          user: { avatarPublicId: null },
          sourceApplication: {
            documents: [
              {
                id: 'portrait-id',
                publicId: 'private-portrait',
                fileFormat: 'webp',
                deliveryType: 'authenticated',
              },
            ],
          },
        }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(transaction),
      ),
    };
    const mediaStorage = {
      publishPrivateImage: jest.fn().mockResolvedValue({
        publicId: 'new-upload',
        secureUrl: 'https://example.test/new.webp',
      }),
      deleteImage: jest.fn().mockResolvedValue(true),
    };
    const service = new AdminProviderManagementService(
      prisma as never,
      { record: jest.fn() } as never,
      { remove: jest.fn() } as never,
      mediaStorage as never,
    );

    await expect(service.backfillMissingAvatars({ limit: 1 })).resolves.toEqual(
      {
        scanned: 1,
        updated: 0,
        skipped: 1,
        failed: 0,
        nextCursor: 'provider-id',
      },
    );
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.providerProfile.update).not.toHaveBeenCalled();
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith('new-upload');
  });
});
