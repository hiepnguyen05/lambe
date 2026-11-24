import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { CreateFeedPostDto } from '../dto/feed.dto';
import { FeedPostsService } from './feed-posts.service';
import { FeedQueryService } from './feed-query.service';
import { FeedAccessService } from './organization/feed-access.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { FeedMediaCleanupService } from './feed-media-cleanup.service';

const jpeg = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  size: 4,
} as Express.Multer.File;
const mp4 = {
  buffer: Buffer.from('....ftypisom', 'ascii'),
  size: 12,
} as Express.Multer.File;
const dto: CreateFeedPostDto = {
  caption: 'Một kiểu tóc mới',
  providerServiceIds: ['service-1'],
  includesCustomer: false,
  hasCustomerConsent: false,
};

describe('FeedPostsService', () => {
  const db = {
    feedPost: { create: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const queries = { ownedDetail: jest.fn() };
  const access = { resolve: jest.fn(), assertServices: jest.fn() };
  const audit = { record: jest.fn() };
  const media = {
    uploadFeedImage: jest.fn(),
    uploadFeedVideo: jest.fn(),
    deleteImage: jest.fn(),
    deleteFeedVideo: jest.fn(),
  };
  const cleanup = {
    enqueue: jest.fn(),
    enqueueAfterFailure: jest.fn(),
    removeNow: jest.fn(),
  };
  let service: FeedPostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation(
      async (callback: (tx: typeof db) => Promise<unknown>) => callback(db),
    );
    db.feedPost.create.mockResolvedValue({ id: 'post-1' });
    db.feedPost.findUnique.mockResolvedValue(null);
    queries.ownedDetail.mockResolvedValue({ id: 'post-1' });
    access.resolve.mockResolvedValue({
      providerId: 'provider-1',
      providerType: 'INDIVIDUAL',
      memberId: null,
      membershipVersion: null,
      role: 'OWNER',
    });
    access.assertServices.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
    media.uploadFeedImage.mockResolvedValue({
      publicId: 'image-1',
      secureUrl: 'https://cdn/image',
      format: 'jpg',
      resourceType: 'image',
    });
    media.uploadFeedVideo.mockResolvedValue({
      publicId: 'video-1',
      secureUrl: 'https://cdn/video',
      format: 'mp4',
      resourceType: 'video',
      durationSeconds: 30,
    });
    media.deleteImage.mockResolvedValue(true);
    media.deleteFeedVideo.mockResolvedValue(true);
    service = new FeedPostsService(
      db as unknown as PrismaService,
      queries as unknown as FeedQueryService,
      media,
      access as unknown as FeedAccessService,
      audit as unknown as AuditService,
      cleanup as unknown as FeedMediaCleanupService,
    );
  });

  const create = (value: CreateFeedPostDto = dto, files = [jpeg]) =>
    service.create('user-1', value, files, {}, 'feed_request_123');

  it('requires an idempotency key before doing any work', async () => {
    await expect(service.create('user-1', dto, [jpeg])).rejects.toThrow(
      BadRequestException,
    );
    expect(access.resolve).not.toHaveBeenCalled();
    expect(media.uploadFeedImage).not.toHaveBeenCalled();
  });

  it('refuses a provider who is not active', async () => {
    access.resolve.mockRejectedValue(new ForbiddenException());
    await expect(create()).rejects.toThrow(ForbiddenException);
    expect(media.uploadFeedImage).not.toHaveBeenCalled();
  });

  it('requires customer consent when customer is shown', async () => {
    await expect(create({ ...dto, includesCustomer: true })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a service outside the provider and does not upload', async () => {
    access.assertServices.mockRejectedValue(new BadRequestException());
    await expect(create()).rejects.toThrow(BadRequestException);
    expect(media.uploadFeedImage).not.toHaveBeenCalled();
  });

  it('stores image and linked service', async () => {
    await create();
    const calls: unknown = db.feedPost.create.mock.calls;
    const [call] = calls as [
      { data: { providerId: string; media: object; services: object } },
    ][];
    expect(call[0].data.providerId).toBe('provider-1');
    expect(call[0].data.media).toBeDefined();
    expect(call[0].data.services).toBeDefined();
    expect(media.deleteImage).not.toHaveBeenCalled();
  });

  it('deletes uploaded video when duration exceeds limit', async () => {
    media.uploadFeedVideo.mockResolvedValue({
      publicId: 'video-1',
      resourceType: 'video',
      durationSeconds: 61,
    });
    await expect(create(dto, [mp4])).rejects.toThrow(BadRequestException);
    expect(cleanup.removeNow).toHaveBeenCalledWith([
      { publicId: 'video-1', kind: 'VIDEO' },
    ]);
    expect(db.feedPost.create).not.toHaveBeenCalled();
  });

  it('cleans uploaded media after database failure', async () => {
    db.feedPost.create.mockRejectedValue(new Error('db down'));
    await expect(create()).rejects.toThrow('db down');
    expect(cleanup.enqueueAfterFailure).toHaveBeenCalledWith([
      { publicId: 'image-1', kind: 'IMAGE' },
    ]);
  });

  it('returns the original post for the same idempotent request', async () => {
    const mediaHash = createHash('sha256').update(jpeg.buffer).digest('hex');
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          caption: dto.caption,
          memberId: null,
          providerServiceIds: dto.providerServiceIds,
          includesCustomer: false,
          hasCustomerConsent: false,
          mediaHashes: [mediaHash],
        }),
      )
      .digest('hex');
    db.feedPost.findUnique.mockResolvedValue({
      id: 'post-1',
      requestHash,
    });
    await create();
    expect(media.uploadFeedImage).not.toHaveBeenCalled();
    expect(queries.ownedDetail).toHaveBeenCalledWith('post-1', 'user-1');
  });
});
