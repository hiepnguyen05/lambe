import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FeedReportReason } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedSocialService } from './feed-social.service';

describe('FeedSocialService', () => {
  const db = {
    feedPost: { findFirst: jest.fn() },
    feedLike: { upsert: jest.fn(), deleteMany: jest.fn() },
    feedComment: { findFirst: jest.fn(), create: jest.fn() },
    providerProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
    providerFollow: { upsert: jest.fn() },
  };
  const service = new FeedSocialService(db as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    db.feedPost.findFirst.mockResolvedValue({
      id: 'post',
      providerId: 'provider',
    });
  });

  it('does not like a hidden or deleted post', async () => {
    db.feedPost.findFirst.mockResolvedValue(null);
    await expect(service.like('user', 'post')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.feedLike.upsert).not.toHaveBeenCalled();
  });

  it('likes idempotently with a composite key', async () => {
    await service.like('user', 'post');
    expect(db.feedLike.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId_userId: { postId: 'post', userId: 'user' } },
      }),
    );
  });

  it('rejects replies to replies', async () => {
    db.feedComment.findFirst.mockResolvedValue(null);
    await expect(
      service.comment('user', 'post', { text: 'hello', parentId: 'reply' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents self-follow', async () => {
    db.providerProfile.findFirst.mockResolvedValue({ userId: 'user' });
    await expect(service.follow('user', 'provider')).rejects.toThrow(
      BadRequestException,
    );
    expect(db.providerFollow.upsert).not.toHaveBeenCalled();
  });

  it('prevents a worker from reporting their own published post', async () => {
    db.feedPost.findFirst.mockResolvedValue({
      id: 'post',
      providerId: 'provider',
      createdByUserId: 'worker',
    });
    db.providerProfile.findUnique.mockResolvedValue({ userId: 'owner' });
    await expect(
      service.report('worker', 'post', { reason: FeedReportReason.SPAM }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('prevents self-report', async () => {
    db.providerProfile.findUnique.mockResolvedValue({ userId: 'user' });
    await expect(
      service.report('user', 'post', { reason: FeedReportReason.SPAM }),
    ).rejects.toThrow(ForbiddenException);
  });
});
