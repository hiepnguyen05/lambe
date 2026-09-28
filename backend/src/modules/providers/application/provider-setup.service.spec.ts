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
    $queryRaw: jest.fn().mockResolvedValue([{ id: current.id }]),
    providerProfile: {
      findUnique: jest.fn().mockResolvedValue(current),
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
