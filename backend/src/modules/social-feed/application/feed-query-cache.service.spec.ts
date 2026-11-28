import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedQueryService } from './feed-query.service';
import { FeedCacheService } from './feed-cache.service';
import { FeedAccessService } from './organization/feed-access.service';
import { FeedLiveReadService } from './feed-live-read.service';

describe('Feed reads with public object cache', () => {
  const content = {
    id: 'post',
    revisionNumber: 1,
    caption: 'Tác phẩm',
    authorMember: null,
    media: [
      {
        id: 'media',
        kind: 'IMAGE',
        url: 'https://cdn.example.test/photo.jpg',
        width: 100,
        height: 100,
        durationSeconds: null,
        position: 0,
      },
    ],
  };
  const live = {
    id: 'post',
    providerId: 'provider',
    status: 'PUBLISHED',
    revisionNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    provider: { id: 'provider', displayName: 'Đối tác', avatarUrl: null },
    services: [],
    _count: { likes: 5, comments: 2, saves: 1 },
  };
  const db = {
    feedPost: { findFirst: jest.fn(), findMany: jest.fn() },
    feedLike: { findMany: jest.fn() },
    feedSave: { findMany: jest.fn() },
    providerFollow: { findMany: jest.fn() },
  };
  const cache = {
    isEnabled: () => true,
    getMany: jest.fn(),
    set: jest.fn(),
    coalesce: (_posts: unknown, load: () => Promise<unknown>) => load(),
  };
  const service = new FeedQueryService(
    db as unknown as PrismaService,
    {} as FeedAccessService,
    cache as unknown as FeedCacheService,
    {
      load: (ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ ...live, id }))),
    } as unknown as FeedLiveReadService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    db.feedPost.findFirst.mockResolvedValue(live);
    db.feedPost.findMany.mockResolvedValue([]);
    db.feedLike.findMany.mockResolvedValue([]);
    db.feedSave.findMany.mockResolvedValue([]);
    db.providerFollow.findMany.mockResolvedValue([]);
    cache.getMany.mockResolvedValue([content]);
    cache.set.mockResolvedValue(undefined);
  });

  it('serves cached media but reads live counts and viewer flags for each user', async () => {
    db.feedLike.findMany.mockResolvedValueOnce([{ postId: 'post' }]);
    const first = await service.detail('post', 'user-a');
    const second = await service.detail('post', 'user-b');
    expect(first.viewer.liked).toBe(true);
    expect(second.viewer.liked).toBe(false);
    expect(second.counts).toEqual({ likes: 5, comments: 2, saves: 1 });
    expect(second.media).toEqual(content.media);
    expect(second).not.toHaveProperty('organizationReview');
    expect(db.feedPost.findMany).not.toHaveBeenCalled();
  });

  it('does not read cache when DB visibility rejects a hidden or deleted post', async () => {
    db.feedPost.findFirst.mockResolvedValue(null);
    await expect(service.detail('post')).rejects.toThrow(NotFoundException);
    expect(cache.getMany).not.toHaveBeenCalled();
    const [query] = db.feedPost.findFirst.mock.calls[0] as [{ where: object }];
    expect(query.where).toMatchObject({
      status: 'PUBLISHED',
      provider: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
    });
  });

  it('loads missing bodies in a batch and writes only public content', async () => {
    cache.getMany.mockResolvedValue([null]);
    db.feedPost.findMany.mockResolvedValue([
      {
        ...live,
        caption: 'Mới',
        authorMemberId: null,
        media: [{ ...content.media[0], secureUrl: content.media[0].url }],
      },
    ]);
    const result = await service.detail('post');
    expect(result.caption).toBe('Mới');
    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post' }),
      expect.objectContaining({ caption: 'Mới' }),
    );
    const stored = (cache.set.mock.calls[0] as unknown[])[1] as object;
    expect(stored).not.toHaveProperty('viewer');
    expect(stored).not.toHaveProperty('counts');
    expect(stored).not.toHaveProperty('organizationReview');
  });

  it('keeps public pagination and nextCursor on warm cache', async () => {
    db.feedPost.findMany.mockResolvedValue([live, { ...live, id: 'next' }]);
    const result = await service.list({ limit: 1 });
    expect(result.nextCursor).toBe('post');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('post');
    expect(db.feedPost.findMany).toHaveBeenCalledTimes(1);
  });

  it('preserves nextCursor and avoids loading the lookahead row when liveRead filters an item', async () => {
    const load = jest.fn().mockResolvedValueOnce([live]);
    const filteredService = new FeedQueryService(
      db as unknown as PrismaService,
      {} as FeedAccessService,
      cache as unknown as FeedCacheService,
      { load } as unknown as FeedLiveReadService,
    );
    db.feedPost.findMany.mockResolvedValue([
      live,
      { ...live, id: 'post-2' },
      { ...live, id: 'lookahead' },
    ]);

    const result = await filteredService.list({ limit: 2 });

    expect(load).toHaveBeenCalledWith(['post', 'post-2']);
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBe('post-2');
  });
});
