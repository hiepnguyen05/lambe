import { BadRequestException } from '@nestjs/common';
import {
  CustomerOnboardingStatus,
  CustomerPricePreference,
  Gender,
  ServiceTargetAudience,
} from '@prisma/client';
import { CustomerOnboardingService } from './customer-onboarding.service';

const categoryId = '6f0fb120-f590-4b63-8782-15ae57eeaba0';
const serviceId = '4eb236b4-959d-45b9-a3f0-1f9c8c11f5e7';

function createContext() {
  const profile = {
    id: 'profile-id',
    userId: 'user-id',
    gender: Gender.MALE,
    preferredAudience: ServiceTargetAudience.MEN,
    pricePreference: CustomerPricePreference.BALANCED,
    onboardingStatus: CustomerOnboardingStatus.IN_PROGRESS,
    completedAt: null,
    skippedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryInterests: [],
    serviceInterests: [],
    user: { customerAddresses: [] },
  };
  const customerProfile = {
    upsert: jest.fn().mockResolvedValue(profile),
    update: jest.fn().mockResolvedValue(profile),
  };
  const serviceCategory = {
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([]),
  };
  const standardService = { count: jest.fn().mockResolvedValue(1) };
  const customerCategoryInterest = {
    count: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const customerServiceInterest = {
    count: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const customerAddress = {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'address-id' }),
  };
  const transaction = {
    customerProfile,
    serviceCategory,
    service: standardService,
    customerCategoryInterest,
    customerServiceInterest,
    customerAddress,
  };
  const prisma = {
    ...transaction,
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  return {
    service: new CustomerOnboardingService(prisma as never),
    customerProfile,
    serviceCategory,
    customerCategoryInterest,
    customerServiceInterest,
    customerAddress,
  };
}

describe('CustomerOnboardingService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an empty partial update', async () => {
    const { service } = createContext();
    await expect(service.update('user-id', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('replaces interests and stores the default address atomically', async () => {
    const {
      service,
      customerCategoryInterest,
      customerServiceInterest,
      customerAddress,
    } = createContext();

    await expect(
      service.update('user-id', {
        preferredAudience: ServiceTargetAudience.MEN,
        categoryIds: [categoryId],
        serviceIds: [serviceId],
        defaultAddress: {
          label: 'Nhà',
          addressLine: '12 Nguyễn Huệ, Quận 1',
          latitude: 10.7731,
          longitude: 106.703,
        },
      }),
    ).resolves.toMatchObject({ success: true });

    expect(customerCategoryInterest.createMany).toHaveBeenCalledWith({
      data: [{ customerProfileId: 'profile-id', categoryId }],
    });
    expect(customerServiceInterest.createMany).toHaveBeenCalledWith({
      data: [{ customerProfileId: 'profile-id', serviceId }],
    });
    expect(customerAddress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        isDefault: true,
      }) as object,
    });
  });

  it('rejects inactive or unknown interests', async () => {
    const { service, serviceCategory } = createContext();
    serviceCategory.count.mockResolvedValue(0);

    await expect(
      service.update('user-id', { categoryIds: [categoryId] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one interest before completion', async () => {
    const { service } = createContext();

    await expect(service.complete('user-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('completes onboarding when an active interest exists', async () => {
    const { service, customerProfile, customerCategoryInterest } =
      createContext();
    customerCategoryInterest.count.mockResolvedValue(1);

    await expect(service.complete('user-id')).resolves.toMatchObject({
      success: true,
    });
    expect(customerProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-id' },
      data: expect.objectContaining({
        onboardingStatus: CustomerOnboardingStatus.COMPLETED,
      }) as object,
    });
  });

  it('marks onboarding as skipped without deleting preferences', async () => {
    const { service, customerProfile } = createContext();
    await expect(service.skip('user-id')).resolves.toMatchObject({
      success: true,
    });
    expect(customerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          onboardingStatus: CustomerOnboardingStatus.SKIPPED,
        }) as object,
      }),
    );
  });
});
