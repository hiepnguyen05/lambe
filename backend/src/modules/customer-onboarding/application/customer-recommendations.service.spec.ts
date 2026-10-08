import { CustomerPricePreference, ServiceTargetAudience } from '@prisma/client';
import { CustomerRecommendationsService } from './customer-recommendations.service';

describe('CustomerRecommendationsService', () => {
  it('ranks category interests above generic items', async () => {
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
      recommendationScore: 70,
      reasons: ['CATEGORY_INTEREST', 'AUDIENCE_MATCH'],
    });
  });

  it('reserves discovery slots outside preferred categories', async () => {
    const baseService = {
      id: 'hair-1',
      code: 'HAIR_1',
      name: 'Tóc 1',
      slug: 'toc-1',
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
    const hairServices = Array.from({ length: 5 }, (_, index) => ({
      ...baseService,
      id: `hair-${index + 1}`,
      code: `HAIR_${index + 1}`,
      name: `Tóc ${index + 1}`,
      slug: `toc-${index + 1}`,
      sortOrder: index,
    }));
    const discoveryService = {
      ...baseService,
      id: 'nail-1',
      code: 'NAIL_1',
      name: 'Nail 1',
      slug: 'nail-1',
      categoryId: 'nail-category',
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
        }),
      },
      service: {
        findMany: jest
          .fn()
          .mockResolvedValue([...hairServices, discoveryService]),
      },
    };
    const recommendations = new CustomerRecommendationsService(prisma as never);

    const result = await recommendations.getServices('user-id', { limit: 4 });

    expect(result.data.services).toHaveLength(4);
    expect(
      result.data.services.filter(
        (service) => service.category.id === 'hair-category',
      ),
    ).toHaveLength(3);
    expect(result.data.services[3].id).toBe('nail-1');
  });
});
