import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedQueryService } from './feed-query.service';
import { FeedRecommendationService } from './feed-recommendation.service';

describe('Feed recommendation foundation', () => {
  const db = {
    feedPost: { findFirst: jest.fn(), findMany: jest.fn() },
    feedEngagement: { upsert: jest.fn(), findMany: jest.fn() },
    customerProfile: { findUnique: jest.fn() },
    providerFollow: { findMany: jest.fn() },
  };
  const queries = { publicBatch: jest.fn() };
  let enabled = true;
  const config = { get: () => enabled } as unknown as ConfigService;
  const service = new FeedRecommendationService(
    db as unknown as PrismaService,
    queries as unknown as FeedQueryService,
    config,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    enabled = true;
    db.feedPost.findFirst.mockResolvedValue({ id: 'post' });
    db.feedEngagement.upsert.mockResolvedValue({});
    db.feedEngagement.findMany.mockResolvedValue([]);
    db.customerProfile.findUnique.mockResolvedValue(null);
    db.providerFollow.findMany.mockResolvedValue([]);
    queries.publicBatch.mockResolvedValue([]);
  });
  it('does not collect events or serve recommendations until enabled', async () => {
    enabled = false;
    expect(
      await service.engage('user', 'post', {
        clientEventId: 'key',
        kind: 'VIEW',
      }),
    ).toEqual({ recorded: false });
    await expect(service.recommend('user')).rejects.toThrow(NotFoundException);
    expect(db.feedEngagement.upsert).not.toHaveBeenCalled();
  });
  it('scopes duplicate event IDs to the authenticated account', async () => {
    await service.engage('user-a', 'post', {
      clientEventId: 'key',
      kind: 'VIEW',
    });
    expect(db.feedEngagement.upsert).toHaveBeenCalledWith({
      where: {
        userId_clientEventId: { userId: 'user-a', clientEventId: 'key' },
      },
      create: {
        userId: 'user-a',
        postId: 'post',
        clientEventId: 'key',
        kind: 'VIEW',
        durationMs: undefined,
      },
      update: {},
    });
    db.feedPost.findFirst.mockResolvedValue(null);
    await expect(
      service.engage('user-b', 'post', { clientEventId: 'key', kind: 'VIEW' }),
    ).rejects.toThrow(NotFoundException);
  });
  it('limits repeated providers and hydrates chosen posts in one batch with live visibility', async () => {
    const candidate = (id: string, providerId: string) => ({
      id,
      providerId,
      createdAt: new Date(),
      services: [
        {
          providerService: {
            serviceId: 'service',
            service: { categoryId: 'category' },
          },
        },
      ],
      _count: { likes: 0, saves: 0 },
    });
    db.feedPost.findMany.mockResolvedValue([
      candidate('a', 'same'),
      candidate('b', 'same'),
      candidate('c', 'same'),
      candidate('d', 'another'),
    ]);
    await service.recommend('user');
    const [ids, user] = queries.publicBatch.mock.calls[0] as [string[], string];
    expect(ids).toHaveLength(3);
    expect(ids).toContain('d');
    expect(user).toBe('user');
  });
});
