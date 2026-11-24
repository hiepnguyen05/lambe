import { FeedMediaKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedMediaCleanupService } from './feed-media-cleanup.service';

describe('FeedMediaCleanupService', () => {
  const db = {
    feedMediaCleanup: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const media = {
    uploadFeedImage: jest.fn(),
    uploadFeedVideo: jest.fn(),
    deleteImage: jest.fn(),
    deleteFeedVideo: jest.fn(),
  };
  let service: FeedMediaCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    db.feedMediaCleanup.createMany.mockResolvedValue({ count: 1 });
    db.feedMediaCleanup.updateMany.mockResolvedValue({ count: 1 });
    media.deleteImage.mockResolvedValue(true);
    media.deleteFeedVideo.mockResolvedValue(true);
    service = new FeedMediaCleanupService(
      db as unknown as PrismaService,
      media,
    );
  });

  it('deletes each CDN resource and completes its durable job', async () => {
    await service.removeNow([
      { publicId: 'image-1', kind: FeedMediaKind.IMAGE },
      { publicId: 'video-1', kind: FeedMediaKind.VIDEO },
    ]);
    expect(media.deleteImage).toHaveBeenCalledWith('image-1', 'upload');
    expect(media.deleteFeedVideo).toHaveBeenCalledWith('video-1', 'upload');
    expect(db.feedMediaCleanup.updateMany).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed deletion available for a later retry', async () => {
    media.deleteImage.mockRejectedValue(new Error('cdn unavailable'));
    await service.removeNow([
      { publicId: 'image-1', kind: FeedMediaKind.IMAGE },
    ]);
    const [update] = db.feedMediaCleanup.updateMany.mock.calls[0] as [object];
    expect(update).toMatchObject({
      where: { publicId: 'image-1', completedAt: null },
      data: {
        lockedUntil: null,
        lastError: 'Error: cdn unavailable',
      },
    });
  });
});
