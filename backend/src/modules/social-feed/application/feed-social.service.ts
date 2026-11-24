import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { ProviderProfileStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { CreateFeedCommentDto, ReportFeedPostDto } from '../dto/feed.dto';
import { publicFeedWhere } from '../domain/feed-visibility.policy';
import { FeedSafetyService } from './feed-safety.service';

@Injectable()
export class FeedSocialService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly safety?: FeedSafetyService,
  ) {}

  async like(userId: string, postId: string) {
    await this.publicPost(postId);
    await this.prisma.feedLike.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });
    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    await this.prisma.feedLike.deleteMany({ where: { postId, userId } });
    return { liked: false };
  }

  async save(userId: string, postId: string) {
    await this.publicPost(postId);
    await this.prisma.feedSave.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });
    return { saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.prisma.feedSave.deleteMany({ where: { postId, userId } });
    return { saved: false };
  }

  async follow(userId: string, providerId: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { id: providerId, status: ProviderProfileStatus.ACTIVE },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Không tìm thấy đối tác.');
    if (provider.userId === userId)
      throw new BadRequestException('Không thể theo dõi chính mình.');
    await this.prisma.providerFollow.upsert({
      where: { providerId_userId: { providerId, userId } },
      update: {},
      create: { providerId, userId },
    });
    return { following: true };
  }

  async unfollow(userId: string, providerId: string) {
    await this.prisma.providerFollow.deleteMany({
      where: { providerId, userId },
    });
    return { following: false };
  }

  async comment(userId: string, postId: string, dto: CreateFeedCommentDto) {
    await this.publicPost(postId);
    await this.safety?.assertComment(userId, dto.text);
    if (dto.parentId) {
      const parent = await this.prisma.feedComment.findFirst({
        where: {
          id: dto.parentId,
          postId,
          parentId: null,
          deletedAt: null,
          moderationHidden: false,
        },
        select: { id: true },
      });
      if (!parent)
        throw new BadRequestException(
          'Chỉ được trả lời bình luận gốc còn hiển thị.',
        );
    }
    const comment = await this.prisma.feedComment.create({
      data: { postId, userId, text: dto.text, parentId: dto.parentId },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    return {
      id: comment.id,
      postId,
      parentId: comment.parentId,
      text: comment.text,
      user: comment.user,
      createdAt: comment.createdAt,
    };
  }

  async deleteComment(userId: string, postId: string, commentId: string) {
    const result = await this.prisma.feedComment.updateMany({
      where: { id: commentId, postId, userId, deletedAt: null },
      data: { deletedAt: new Date(), text: '' },
    });
    if (!result.count)
      throw new NotFoundException('Không tìm thấy bình luận của bạn.');
    return { deleted: true };
  }

  async report(userId: string, postId: string, dto: ReportFeedPostDto) {
    const post = await this.publicPost(postId);
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: post.providerId },
      select: { userId: true },
    });
    if (provider?.userId === userId || post.createdByUserId === userId)
      throw new ForbiddenException('Không thể báo cáo bài của chính mình.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM feed_posts WHERE id=${postId} FOR SHARE`,
      );
      const live = await tx.feedPost.findFirst({
        where: { id: postId, ...publicFeedWhere },
        select: { revisionNumber: true },
      });
      if (!live) throw new NotFoundException('Bài không còn công khai.');
      await tx.feedReport.upsert({
        where: {
          postId_userId_revisionNumber: {
            postId,
            userId,
            revisionNumber: live.revisionNumber,
          },
        },
        update: {},
        create: {
          postId,
          userId,
          revisionNumber: live.revisionNumber,
          reason: dto.reason,
          detail: dto.detail,
        },
      });
    });
    await this.safety?.flagReport(postId, dto.reason);
    return { reported: true };
  }

  private async publicPost(id: string) {
    const post = await this.prisma.feedPost.findFirst({
      where: {
        id,
        ...publicFeedWhere,
      },
      select: {
        id: true,
        providerId: true,
        revisionNumber: true,
        createdByUserId: true,
      },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng.');
    return post;
  }
}
