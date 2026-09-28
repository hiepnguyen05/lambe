import { CustomerPricePreference, ServiceTargetAudience } from '@prisma/client';
import { CustomerRecommendationsService } from './customer-recommendations.service';

describe('CustomerRecommendationsService', () => {
  it('ranks explicit service and category interests above generic items', async () => {
    const selectedService = {
      id: 'selected-service',
      code: 'MEN_HAIRCUT',
      name: 'Cắt tóc nam',
      slug: 'cat-toc-nam',
      description: null,
      iconUrl: null,
      coverImageUrl: null,
      minPriceAmount: 50000,
      maxPriceAmount: 300000,
      currencyCode: 'VND',
      defaultDurationMinutes: 45,
      targetAudience: ServiceTargetAudience.MEN,
      sortOrder: 0,
      categoryId: 'hair-category',
      category: {
        id: 'hair-category',
        code: 'HAIR',
        name: 'Tóc',
        slug: 'toc',
      },
    };
    const genericService = {
      ...selectedService,
      id: 'generic-service',
      code: 'NAIL',
      name: 'Làm nail',
      slug: 'lam-nail',
      categoryId: 'nail-category',
      targetAudience: ServiceTargetAudience.ALL,
      category: {
        id: 'nail-category',
        code: 'NAIL',
        name: 'Nail',
        slug: 'nail',
      },
    };
    const prisma = {
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({
          preferredAudience: ServiceTargetAudience.MEN,
          pricePreference: CustomerPricePreference.BALANCED,
          categoryInterests: [{ categoryId: 'hair-category' }],
          serviceInterests: [{ serviceId: 'selected-service' }],
        }),
      },
      service: {
        findMany: jest
          .fn()
          .mockResolvedValue([genericService, selectedService]),
      },
    };
    const recommendations = new CustomerRecommendationsService(prisma as never);

    const result = await recommendations.getServices('user-id', { limit: 10 });

    expect(result.data.personalized).toBe(true);
    expect(result.data.services[0]).toMatchObject({
      id: 'selected-service',
      recommendationScore: 170,
      reasons: ['SERVICE_INTEREST', 'CATEGORY_INTEREST', 'AUDIENCE_MATCH'],
    });
  });
});
