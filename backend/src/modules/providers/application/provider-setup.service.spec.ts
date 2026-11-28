import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import { ProviderSetupService } from './provider-setup.service';

function context() {
  const current = {
    id: 'provider',
    userId: 'owner',
    sourceApplicationId: 'application',
    status: ProviderProfileStatus.SETUP_REQUIRED as ProviderProfileStatus,
    setupCompletedAt: null,
  };
  const selected = {
    id: 'provider-service',
    status: ProviderServiceStatus.INACTIVE as ProviderServiceStatus,
    priceAmount: 100_000,
    service: {
      status: ServiceStatus.ACTIVE as ServiceStatus,
      category: { status: ServiceCategoryStatus.ACTIVE },
      minPriceAmount: 50_000,
      maxPriceAmount: 150_000,
    },
  };
  const transaction = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { id: current.id, status: ProviderProfileStatus.SETUP_REQUIRED },
      ]),
    providerProfile: {
      findUnique: jest.fn().mockResolvedValue(current),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        serviceAreaName: null,
        serviceAreaLatitude: null,
        serviceAreaLongitude: null,
        serviceRadiusKm: null,
        workingHours: [],
        services: [],
      }),
      update: jest.fn().mockResolvedValue({
        id: current.id,
        status: ProviderProfileStatus.ACTIVE,
      }),
    },
    providerService: {
      findMany: jest.fn().mockResolvedValue([selected]),
      updateMany: jest.fn(),
    },
    providerWorkingHour: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    ...transaction,
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const audit = { record: jest.fn() };
  const dto = {
    serviceAreaName: 'Ha Noi',
    serviceAreaLatitude: 21.0368,
    serviceAreaLongitude: 105.7827,
    serviceRadiusKm: 10,
    enabledServiceIds: [selected.id],
    workingHours: [{ dayOfWeek: 1, startMinute: 480, endMinute: 1020 }],
  };
  return {
    service: new ProviderSetupService(prisma as never, audit as never),
    transaction,
    current,
    selected,
    dto,
    audit,
  };
}

describe('Provider setup', () => {
  it('updates the fixed service area without replacing working hours or service selections', async () => {
    const { service, transaction, audit } = context();
    const area = {
      serviceAreaName: 'Khu vực mới',
      serviceAreaLatitude: 21.1,
      serviceAreaLongitude: 106.1,
      serviceRadiusKm: 10,
    };
    await service.updateServiceArea('owner', area, {});
    expect(transaction.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'provider' },
      data: area,
    });
    expect(transaction.providerWorkingHour.deleteMany).not.toHaveBeenCalled();
    expect(transaction.providerService.updateMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVIDER_SERVICE_AREA_UPDATED' }),
      {},
      transaction,
    );
  });
  it('saves radius without requiring working hours or changing setup status', async () => {
    const { service, transaction, audit } = context();
    await service.updateRadius('owner', 12, {});
    expect(transaction.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { serviceRadiusKm: 12 },
      }),
    );
    expect(transaction.providerWorkingHour.deleteMany).not.toHaveBeenCalled();
    expect(transaction.providerService.updateMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVIDER_RADIUS_UPDATED' }),
      {},
      transaction,
    );
  });

  it('saves working hours without requiring enabled services or changing radius', async () => {
    const { service, transaction, dto } = context();
    await service.updateWorkingHours('owner', dto.workingHours, {});
    expect(transaction.providerWorkingHour.createMany).toHaveBeenCalledWith({
      data: [{ providerId: 'provider', ...dto.workingHours[0] }],
    });
    expect(transaction.providerProfile.update).not.toHaveBeenCalled();
    expect(transaction.providerService.updateMany).not.toHaveBeenCalled();
  });

  it('completes first setup and activates eligible services after the last required setting is saved', async () => {
    const { service, transaction, dto, selected } = context();
    transaction.providerProfile.findUniqueOrThrow.mockResolvedValue({
      serviceAreaName: 'Quận 1',
      serviceAreaLatitude: 10.77,
      serviceAreaLongitude: 106.7,
      serviceRadiusKm: 10,
      workingHours: [{ id: 'hour-id' }],
      services: [
        selected,
        { ...selected, id: 'invalid-price', priceAmount: 1 },
      ],
    });

    await service.updateWorkingHours('owner', dto.workingHours, {});

    expect(transaction.providerService.updateMany).toHaveBeenCalledWith({
      where: {
        providerId: 'provider',
        id: { in: ['provider-service'] },
        status: ProviderServiceStatus.INACTIVE,
      },
      data: { status: ProviderServiceStatus.ACTIVE },
    });
    const updates = transaction.providerProfile.update.mock
      .calls as unknown as Array<
      [
        {
          where: { id: string };
          data: { status?: ProviderProfileStatus; setupCompletedAt?: Date };
        },
      ]
    >;
    const activation = updates.find(
      ([args]) => args.data.status === ProviderProfileStatus.ACTIVE,
    );
    expect(activation?.[0].where.id).toBe('provider');
    expect(activation?.[0].data.setupCompletedAt).toBeInstanceOf(Date);
  });

  it('does not allow partial edits for a suspended provider', async () => {
    const { service, transaction } = context();
    transaction.$queryRaw.mockResolvedValueOnce([
      { id: 'provider', status: ProviderProfileStatus.SUSPENDED },
    ]);
    await expect(service.updateRadius('owner', 12, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction.providerProfile.update).not.toHaveBeenCalled();
  });
  it('only allows an approved provider to configure services', async () => {
    const { service, transaction, dto } = context();
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(service.configure('owner', dto, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('does not reactivate a suspended provider', async () => {
    const { service, current, dto } = context();
    current.status = ProviderProfileStatus.SUSPENDED;
    await expect(service.configure('owner', dto, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it.each([
    'foreign-service',
    'suspended-service',
    'inactive-service',
    'invalid-price',
  ])('rejects %s selections', async (reason) => {
    const { service, selected, transaction, dto } = context();
    if (reason === 'foreign-service')
      transaction.providerService.findMany.mockResolvedValue([]);
    if (reason === 'suspended-service')
      selected.status = ProviderServiceStatus.SUSPENDED;
    if (reason === 'inactive-service')
      selected.service.status = ServiceStatus.INACTIVE;
    if (reason === 'invalid-price') selected.priceAmount = 1;
    await expect(service.configure('owner', dto, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.providerProfile.update).not.toHaveBeenCalled();
  });
  it('persists setup, activates selected approved services and records an audit atomically', async () => {
    const { service, transaction, dto, audit } = context();
    await expect(service.configure('owner', dto, {})).resolves.toHaveProperty(
      'data.status',
      ProviderProfileStatus.ACTIVE,
    );
    expect(transaction.providerWorkingHour.createMany).toHaveBeenCalledWith({
      data: [{ providerId: 'provider', ...dto.workingHours[0] }],
    });
    expect(transaction.providerService.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerId: 'provider',
          id: { in: ['provider-service'] },
          status: { not: ProviderServiceStatus.SUSPENDED },
        },
        data: { status: ProviderServiceStatus.ACTIVE },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROVIDER_SETUP_UPDATED' }),
      {},
      transaction,
    );
  });
});
