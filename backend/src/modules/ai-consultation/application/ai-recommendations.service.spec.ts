import {
  FeedPostStatus,
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import { AiRecommendationsService } from './ai-recommendations.service';

describe('AiRecommendationsService', () => {
  const prisma = {
    service: { findMany: jest.fn() },
    feedPost: { findMany: jest.fn() },
  };
  const service = new AiRecommendationsService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('resolves only active catalog services by normalized name', async () => {
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'hair',
        name: 'Cắt tóc nam',
        normalizedName: 'cat toc nam',
        minPriceAmount: 100000,
        maxPriceAmount: 200000,
        currencyCode: 'VND',
      },
    ]);
    const result = await service.services(['Cắt tóc nam'], 'Tư vấn đi date');
    expect(result).toEqual([
      {
        id: 'hair',
        name: 'Cắt tóc nam',
        minPriceAmount: 100000,
        maxPriceAmount: 200000,
        currencyCode: 'VND',
      },
    ]);
    const calls = prisma.service.findMany.mock.calls as unknown as [
      Prisma.ServiceFindManyArgs,
    ][];
    const query = calls[0][0];
    expect(query.where?.status).toBe(ServiceStatus.ACTIVE);
    expect(query.where?.category).toEqual({
      status: ServiceCategoryStatus.ACTIVE,
    });
    expect(query.where?.OR).toContainEqual({
      normalizedName: { contains: 'cat' },
    });
    expect(query.take).toBe(100);
  });

  it('fetches at most six published posts with active provider and service', async () => {
    prisma.feedPost.findMany.mockResolvedValue([
      {
        id: 'post',
        provider: { id: 'provider', displayName: 'Thợ tóc', avatarUrl: null },
        media: [
          {
            kind: 'IMAGE',
            secureUrl: 'https://res.cloudinary.com/lambe/image/upload/sample',
          },
        ],
        services: [
          { providerService: { service: { id: 'hair', name: 'Cắt tóc nam' } } },
        ],
      },
    ]);
    const result = await service.posts(['hair']);
    expect(result[0]).toMatchObject({
      id: 'post',
      service: { id: 'hair' },
      provider: { id: 'provider' },
    });
    expect(prisma.feedPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 6,
        where: {
          status: FeedPostStatus.PUBLISHED,
          moderationStatus: 'APPROVED',
          recommendationStatus: 'ELIGIBLE',
          OR: [
            { organizationReviewStatus: null },
            { organizationReviewStatus: 'APPROVED' },
          ],
          provider: {
            status: ProviderProfileStatus.ACTIVE,
            user: { status: UserStatus.ACTIVE },
          },
          services: {
            some: {
              providerService: {
                status: ProviderServiceStatus.ACTIVE,
                serviceId: { in: ['hair'] },
                service: {
                  status: ServiceStatus.ACTIVE,
                  category: { status: ServiceCategoryStatus.ACTIVE },
                },
              },
            },
          },
        },
      }),
    );
  });

  it('does not expose non-HTTPS media URLs or posts without eligible service', async () => {
    prisma.feedPost.findMany.mockResolvedValue([
      {
        id: 'bad-url',
        provider: {},
        media: [{ kind: 'IMAGE', secureUrl: 'http://unsafe' }],
        services: [{ providerService: { service: { id: 'hair' } } }],
      },
      {
        id: 'no-service',
        provider: {},
        media: [{ kind: 'IMAGE', secureUrl: 'https://safe' }],
        services: [],
      },
    ]);
    expect(await service.posts(['hair'])).toEqual([]);
    expect(await service.posts([])).toEqual([]);
  });
});
