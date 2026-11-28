import { FeedPostStatus, ProviderProfileStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedQueryService } from './feed-query.service';
import { FeedAccessService } from './organization/feed-access.service';
import { FeedCacheService } from './feed-cache.service';
import { FeedLiveReadService } from './feed-live-read.service';

describe('FeedQueryService', () => {
  const db = { feedPost: { findMany: jest.fn() } };
  const access = {
    managedScope: jest
      .fn()
      .mockResolvedValue({ OR: [{ providerId: 'owned' }] }),
  };
  const service = new FeedQueryService(
    db as unknown as PrismaService,
    access as unknown as FeedAccessService,
    { isEnabled: () => false } as FeedCacheService,
    {} as FeedLiveReadService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    db.feedPost.findMany.mockResolvedValue([]);
  });

  it('exposes only published posts from active providers', async () => {
    await service.list({ limit: 20 });
    const calls: unknown = db.feedPost.findMany.mock.calls;
    const [call] = calls as [
      {
        where: {
          AND: {
            status: FeedPostStatus;
            provider: { status: ProviderProfileStatus };
          }[];
        };
      },
    ][];
    expect(call[0].where.AND[0].status).toBe(FeedPostStatus.PUBLISHED);
    expect(call[0].where.AND[0].provider.status).toBe(
      ProviderProfileStatus.ACTIVE,
    );
  });

  it('allows only the owner to query hidden posts in mine mode', async () => {
    await service.list({ limit: 20 }, 'user-1', 'mine');
    const calls: unknown = db.feedPost.findMany.mock.calls;
    const [call] = calls as [
      {
        where: {
          status: { not: FeedPostStatus };
          AND: unknown[];
        };
      },
    ][];
    expect(call[0].where.status.not).toBe(FeedPostStatus.DELETED);
    expect(access.managedScope).toHaveBeenCalledWith('user-1');
    expect(call[0].where.AND).toContainEqual({ OR: [{ providerId: 'owned' }] });
  });

  it('filters by categorySlug and search query across caption, provider, author, and service name', async () => {
    await service.list({
      limit: 20,
      categorySlug: 'lam-nail',
      search: 'son gel',
    });
    const calls: unknown = db.feedPost.findMany.mock.calls;
    const [call] = calls as [{ where: { AND: Record<string, unknown>[] } }][];
    expect(call[0].where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          services: {
            some: expect.objectContaining({
              providerService: expect.objectContaining({
                service: expect.objectContaining({
                  category: expect.objectContaining({ slug: 'lam-nail' }),
                }),
              }),
            }),
          },
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([
            { caption: { contains: 'son gel', mode: 'insensitive' } },
            { provider: { displayName: { contains: 'son gel', mode: 'insensitive' } } },
          ]),
        }),
      ]),
    );
  });
});
