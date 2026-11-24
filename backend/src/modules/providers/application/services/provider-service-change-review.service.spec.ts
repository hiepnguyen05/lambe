import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  InternalRole,
  ProviderServiceChangeStatus,
  ProviderServiceChangeType,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import { ProviderServiceChangeReviewService } from './provider-service-change-review.service';

function context() {
  const change = {
    id: 'request-id',
    providerId: 'provider-id',
    providerServiceId: 'offering-id',
    serviceId: 'service-id',
    type: ProviderServiceChangeType.UPDATE_OFFERING as ProviderServiceChangeType,
    status: ProviderServiceChangeStatus.PENDING_REVIEW,
    proposedPriceAmount: 120_000,
    proposedDurationMinutes: 60,
    proposedDescription: 'Cắt tóc tại nhà',
    documents: [],
  };
  const catalogService = {
    id: 'service-id',
    status: ServiceStatus.ACTIVE,
    minPriceAmount: 50_000,
    maxPriceAmount: 200_000,
    requiresCertificate: false,
    minPortfolioImages: 0,
    minExperienceYears: 0,
    category: { status: ServiceCategoryStatus.ACTIVE },
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'provider-id' }]),
    providerProfile: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'provider-id',
        status: 'ACTIVE',
        sourceApplicationId: 'application-id',
        experienceYears: 5,
      }),
    },
    providerServiceChangeRequest: {
      findUnique: jest.fn().mockResolvedValue({ providerId: 'provider-id' }),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(() => Promise.resolve(change)),
      update: jest.fn().mockResolvedValue({ ...change, status: 'APPROVED' }),
    },
    service: {
      findUnique: jest
        .fn()
        .mockImplementation(() => Promise.resolve(catalogService)),
    },
    providerApplicationDocument: { findMany: jest.fn().mockResolvedValue([]) },
    providerServiceChangeDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    providerService: {
      findFirst: jest.fn().mockResolvedValue({ id: 'offering-id' }),
      update: jest.fn(),
    },
    providerApplication: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (arg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: jest.fn() };
  const notification = { enqueue: jest.fn() };
  const review = new ProviderServiceChangeReviewService(
    prisma as never,
    audit as never,
    { assertAvailable: jest.fn() },
    { invalidateActive: jest.fn() } as never,
    notification as never,
  );
  return { review, tx, change, catalogService };
}

describe('provider service change review', () => {
  it('applies the approved price to the offering atomically', async () => {
    const { review, tx } = context();
    await review.approve(
      'request-id',
      {},
      'reviewer',
      [InternalRole.SERVICE_REVIEWER],
      {},
    );
    const offeringUpdates = tx.providerService.update.mock
      .calls as unknown as Array<
      [{ where: { id: string }; data: { priceAmount: number } }]
    >;
    expect(offeringUpdates[0][0].where.id).toBe('offering-id');
    expect(offeringUpdates[0][0].data.priceAmount).toBe(120_000);
    const decisions = tx.providerServiceChangeRequest.update.mock
      .calls as unknown as Array<
      [{ data: { status: ProviderServiceChangeStatus } }]
    >;
    expect(decisions[0][0].data.status).toBe(
      ProviderServiceChangeStatus.APPROVED,
    );
  });

  it('rechecks the current price ceiling before approval', async () => {
    const { review, tx, catalogService } = context();
    catalogService.maxPriceAmount = 100_000;
    await expect(
      review.approve(
        'request-id',
        {},
        'reviewer',
        [InternalRole.SERVICE_REVIEWER],
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.providerService.update).not.toHaveBeenCalled();
  });

  it('requires admin rights to create a new global service', async () => {
    const { review, tx, change } = context();
    tx.providerServiceChangeRequest.findUniqueOrThrow.mockResolvedValue({
      ...change,
      type: ProviderServiceChangeType.PROPOSE_NEW_SERVICE,
    });
    await expect(
      review.approve(
        'request-id',
        {},
        'reviewer',
        [InternalRole.SERVICE_REVIEWER],
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.providerServiceChangeRequest.update).not.toHaveBeenCalled();
  });
});
