import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ProviderDocumentType,
  ProviderApplicationStatus,
  ProviderServiceSuggestionStatus,
  ReviewStatus,
  ServiceCategoryStatus,
} from '@prisma/client';
import { ReviewProviderServiceSuggestionService } from './review-provider-service-suggestion.service';

const applicationId = '3b3397ea-aef4-4b75-87ef-4188add96e43';
const suggestionId = '31c3ac09-700b-43fc-aafa-d17523ed7d43';
const actorId = 'ab1dd0de-b692-4783-b8ad-c5b83408ca9c';
const categoryId = '62952292-1909-4cf3-9a99-77291e2c9ed7';

function context() {
  const suggestion = {
    id: suggestionId,
    applicationId,
    name: 'Tạo kiểu tóc đi tiệc',
    description: 'Tại nhà',
    durationMinutes: 60,
    proposedPriceAmount: 180_000,
    status: ProviderServiceSuggestionStatus.PENDING,
  };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
    providerApplication: {
      findUnique: jest.fn().mockResolvedValue({
        status: ProviderApplicationStatus.PENDING_REVIEW,
        experienceYears: 3,
        documents: [
          {
            applicationServiceId: null,
            type: ProviderDocumentType.PROFESSIONAL_CERTIFICATE,
            status: ReviewStatus.PENDING,
            deliveryType: 'authenticated',
            fileFormat: 'jpg',
          },
          {
            applicationServiceId: null,
            type: ProviderDocumentType.PORTFOLIO,
            status: ReviewStatus.PENDING,
            deliveryType: 'authenticated',
            fileFormat: 'jpg',
          },
        ],
      }),
    },
    providerServiceSuggestion: {
      findFirst: jest.fn().mockResolvedValue(suggestion),
      update: jest.fn().mockResolvedValue({
        ...suggestion,
        status: ProviderServiceSuggestionStatus.REJECTED,
      }),
    },
    serviceCategory: {
      findUnique: jest.fn().mockResolvedValue({
        status: ServiceCategoryStatus.ACTIVE,
      }),
    },
    service: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'new-service',
          ...data,
        }),
      ),
    },
    providerApplicationService: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'new-application-service',
          ...data,
        }),
      ),
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
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const uniqueness = {
    assertAvailable: jest.fn().mockResolvedValue(undefined),
  };
  const cache = { invalidateActive: jest.fn().mockResolvedValue(undefined) };
  const service = new ReviewProviderServiceSuggestionService(
    prisma as never,
    audit as never,
    uniqueness,
    cache as never,
  );
  const dto = {
    categoryId,
    code: 'EVENT_HAIR',
    name: 'Tạo kiểu tóc đi tiệc',
    slug: 'tao-kieu-toc-di-tiec',
    minPriceAmount: 100_000,
    maxPriceAmount: 300_000,
    requiresCertificate: true,
    minPortfolioImages: 1,
  };
  return { service, prisma, audit, cache, dto };
}

describe('ReviewProviderServiceSuggestionService', () => {
  it('creates and verifies a service while uploaded evidence is still pending review', async () => {
    const { service, prisma, audit, cache, dto } = context();

    const result = await service.approve(
      applicationId,
      suggestionId,
      dto,
      actorId,
      {},
    );

    expect(JSON.stringify(prisma.service.create.mock.calls)).toContain(
      '"status":"ACTIVE"',
    );
    expect(
      JSON.stringify(prisma.providerApplicationService.create.mock.calls),
    ).toContain('"proposedPriceAmount":180000');
    expect(
      JSON.stringify(prisma.providerApplicationService.create.mock.calls),
    ).toContain('"serviceId":"new-service"');
    expect(
      JSON.stringify(prisma.providerApplicationService.create.mock.calls),
    ).toContain('"status":"VERIFIED"');
    expect(
      JSON.stringify(prisma.providerServiceSuggestion.update.mock.calls),
    ).toContain('"approvedServiceId":"new-service"');
    expect(audit.record).toHaveBeenCalled();
    expect(cache.invalidateActive).toHaveBeenCalledTimes(1);
    expect(result.data.applicationService.id).toBe('new-application-service');
  });

  it('rejects a catalog price range that excludes the provider price', async () => {
    const { service, prisma, dto } = context();

    await expect(
      service.approve(
        applicationId,
        suggestionId,
        { ...dto, maxPriceAmount: 150_000 },
        actorId,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('does not approve an already handled suggestion', async () => {
    const { service, prisma, dto } = context();
    prisma.providerServiceSuggestion.findFirst.mockResolvedValue({
      status: ProviderServiceSuggestionStatus.APPROVED,
    });

    await expect(
      service.approve(applicationId, suggestionId, dto, actorId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('keeps the services section pending when rejecting one suggestion', async () => {
    const { service, prisma } = context();

    await service.reject(
      applicationId,
      suggestionId,
      { reason: 'Dịch vụ trùng lặp.' },
      actorId,
      {},
    );

    expect(
      JSON.stringify(prisma.providerApplicationCheck.updateMany.mock.calls),
    ).toContain('"status":"PENDING"');
    expect(prisma.service.create).not.toHaveBeenCalled();
  });
});
