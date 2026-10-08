import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ProviderApplicationSection,
  ProviderApplicationStatus,
  ReviewStatus,
  ServiceCategoryStatus,
} from '@prisma/client';
import { ProviderServiceSuggestionsService } from './provider-service-suggestions.service';

const applicationId = '3b3397ea-aef4-4b75-87ef-4188add96e43';
const userId = 'acb4e955-4f1d-4e6c-9dfd-c7317bba24be';
const categoryId = '62952292-1909-4cf3-9a99-77291e2c9ed7';

function context() {
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
    providerApplication: {
      findFirst: jest.fn().mockResolvedValue({
        status: ProviderApplicationStatus.DRAFT,
        checks: [
          {
            section: ProviderApplicationSection.SERVICES,
            status: ReviewStatus.PENDING,
          },
        ],
      }),
    },
    serviceCategory: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ status: ServiceCategoryStatus.ACTIVE }),
    },
    service: { findFirst: jest.fn().mockResolvedValue(null) },
    providerApplicationService: { count: jest.fn().mockResolvedValue(0) },
    providerServiceSuggestion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'suggestion-id', status: 'PENDING' }),
    },
    providerApplicationCheck: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...transaction,
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const service = new ProviderServiceSuggestionsService(prisma as never);
  const dto = {
    categoryId,
    name: 'Tạo kiểu tóc đi tiệc',
    proposedPriceAmount: 180_000,
  };
  return { service, transaction, dto };
}

describe('ProviderServiceSuggestionsService', () => {
  it('stores a proposed service in an owned draft', async () => {
    const { service, transaction, dto } = context();

    await service.add(applicationId, userId, dto);

    expect(
      JSON.stringify(transaction.providerServiceSuggestion.create.mock.calls),
    ).toContain('"normalizedName":"tao kieu toc di tiec"');
    expect(transaction.providerApplicationCheck.updateMany).toHaveBeenCalled();
  });

  it('does not reveal another user application', async () => {
    const { service, transaction, dto } = context();
    transaction.$queryRaw.mockResolvedValue([]);

    await expect(
      service.add(applicationId, userId, dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.providerServiceSuggestion.create).not.toHaveBeenCalled();
  });

  it('directs the provider to choose an existing catalog service', async () => {
    const { service, transaction, dto } = context();
    transaction.service.findFirst.mockResolvedValue({ id: 'existing-service' });

    await expect(
      service.add(applicationId, userId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.providerServiceSuggestion.create).not.toHaveBeenCalled();
  });
});
