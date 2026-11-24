import { ConfigService } from '@nestjs/config';
import type { CacheStore } from '../../../infrastructure/cache/cache-store';
import { FeedCacheService } from './feed-cache.service';

describe('FeedCacheService', () => {
  const store = { getMany: jest.fn(), set: jest.fn(), getStatus: jest.fn() };
  const identity = {
    id: 'post',
    revisionNumber: 1,
    updatedAt: new Date('2026-11-20T00:00:00Z'),
  };
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
  let service: FeedCacheService;
  beforeEach(() => {
    jest.resetAllMocks();
    store.getStatus.mockReturnValue('up');
    store.getMany.mockResolvedValue([content]);
    store.set.mockResolvedValue(undefined);
    const config = {
      get: (key: string, fallback: unknown) =>
        key === 'cache.feedEnabled' ? true : fallback,
    };
    service = new FeedCacheService(
      store as unknown as CacheStore,
      config as ConfigService,
    );
  });

  it('whitelists public fields on both read and write', async () => {
    const poisoned = {
      ...content,
      viewer: { liked: true },
      organizationReview: { note: 'private' },
      counts: { likes: 100 },
    };
    store.getMany.mockResolvedValue([poisoned]);
    expect(await service.getMany([identity])).toEqual([content]);
    await service.set(identity, poisoned);
    expect(store.set).toHaveBeenCalledWith(
      expect.stringContaining('revision:1:updated:'),
      content,
      expect.any(Number),
    );
  });

  it('isolates revisions and treats malformed values as misses', async () => {
    store.getMany.mockResolvedValue([{ ...content, revisionNumber: 2 }]);
    expect(await service.getMany([identity])).toEqual([null]);
    store.getMany.mockResolvedValue([
      {
        ...content,
        media: [{ ...content.media[0], url: 'javascript:alert(1)' }],
      },
    ]);
    expect(await service.getMany([identity])).toEqual([null]);
  });

  it('uses a distinct key when an update changes the live version', async () => {
    await service.getMany([identity]);
    await service.getMany([
      {
        ...identity,
        revisionNumber: 2,
        updatedAt: new Date(identity.updatedAt.getTime() + 1),
      },
    ]);
    expect(store.getMany.mock.calls[0]).not.toEqual(
      store.getMany.mock.calls[1],
    );
  });

  it('falls back when Redis is unavailable or rejects', async () => {
    store.getStatus.mockReturnValue('down');
    expect(await service.getMany([identity])).toEqual([null]);
    expect(store.getMany).not.toHaveBeenCalled();
    store.getStatus.mockReturnValue('up');
    store.getMany.mockRejectedValue(new Error('redis unavailable'));
    expect(await service.getMany([identity])).toEqual([null]);
  });

  it('bounds a stalled cache read', async () => {
    jest.useFakeTimers();
    try {
      store.getMany.mockReturnValue(new Promise(() => {}));
      const pending = service.getMany([identity]);
      await jest.advanceTimersByTimeAsync(101);
      expect(await pending).toEqual([null]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('coalesces concurrent cold reads and releases the registry after completion', async () => {
    let finish!: (value: string[]) => void;
    const load = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    );
    const a = service.coalesce([identity], load);
    const b = service.coalesce([identity], load);
    expect(load).toHaveBeenCalledTimes(1);
    finish(['post']);
    expect(await a).toEqual(['post']);
    expect(await b).toEqual(['post']);
    expect(
      await service.coalesce([identity], () => Promise.resolve(['fresh'])),
    ).toEqual(['fresh']);
  });
});
