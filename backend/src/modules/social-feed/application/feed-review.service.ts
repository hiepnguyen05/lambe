import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { FeedAccessService } from './organization/feed-access.service';
import {
  AppealFeedDto,
  ResolveFeedAppealDto,
  ReviewFeedDto,
} from '../dto/feed-moderation.dto';
import { FeedCommentsQueryDto } from '../dto/feed.dto';
import { closeFeedReports, notifyFeedAuthor } from './feed-notices';
import {
  FEED_MEDIA_STORAGE,
  type FeedMediaStorage,
} from './feed-media-storage.port';
import { feedMediaUrl } from './feed-media-url';

@Injectable()
export class FeedReviewService {
  @Optional()
  @Inject(FEED_MEDIA_STORAGE)
  private readonly mediaStorage?: FeedMediaStorage;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: FeedAccessService,
  ) {}

  async queue(query: FeedCommentsQueryDto) {
    const anchor = query.cursor
      ? await this.prisma.feedPost.findUnique({
          where: { id: query.cursor },
          select: { createdAt: true },
        })
      : null;
    if (query.cursor && !anchor)
      throw new BadRequestException('Cursor không hợp lệ.');
    const limit = query.limit ?? 20;
    const rows = await this.prisma.feedPost.findMany({
      where: {
        moderationStatus: 'PENDING',
        status: { not: 'DELETED' },
      },
      include: {
        _count: {
          select: {
            reports: { where: { resolution: null } },
            engagements: true,
          },
        },
        media: { orderBy: { position: 'asc' } },
        provider: { select: { id: true, displayName: true } },
        services: {
          include: {
            providerService: {
              select: { id: true, service: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [
        { safetyScore: 'desc' },
        { reports: { _count: 'desc' } },
        { engagements: { _count: 'desc' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      take: limit + 1,
    });
    return {
      data: rows.slice(0, limit).map((p) => ({
        id: p.id,
        caption: p.caption,
        revisionNumber: p.revisionNumber,
        provider: p.provider,
        media: p.media.map((m) => ({
          id: m.id,
          kind: m.kind,
          url: feedMediaUrl(m, this.mediaStorage),
        })),
        services: p.services,
        includesCustomer: p.includesCustomer,
        hasCustomerConsent: p.hasCustomerConsent,
        organizationReviewStatus: p.organizationReviewStatus,
        createdAt: p.createdAt,
        safetyScore: p.safetyScore,
        safetyLabels: p.safetyLabels,
        reports: p._count.reports,
        engagements: p._count.engagements,
      })),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM feed_posts WHERE id=${id} FOR UPDATE`,
    );
    const post = await tx.feedPost.findUnique({ where: { id } });
    if (!post || post.status === 'DELETED')
      throw new NotFoundException('Không tìm thấy bài đăng.');
    return post;
  }

  async review(id: string, dto: ReviewFeedDto, reviewerId: string) {
    if (
      (dto.decision === 'REJECTED' || !dto.eligible) &&
      (!dto.policyCode || !dto.note)
    )
      throw new BadRequestException(
        'Cần mã chính sách và lý do từ chối/hạn chế.',
      );
    if (dto.decision === 'REJECTED' && dto.eligible)
      throw new BadRequestException('Bài bị từ chối không được gợi ý.');
    return this.prisma.$transaction(async (tx) => {
      const post = await this.lock(tx, id);
      if (
        post.revisionNumber !== dto.revisionNumber ||
        post.moderationStatus !== 'PENDING'
      )
        throw new ConflictException('Bài đã thay đổi hoặc đã được kiểm duyệt.');
      const data = {
        moderationStatus: dto.decision,
        recommendationStatus: dto.eligible
          ? ('ELIGIBLE' as const)
          : ('INELIGIBLE' as const),
        moderationPolicyCode: dto.policyCode ?? null,
        moderationNote: dto.note ?? null,
        moderationReviewedAt: new Date(),
        moderationReviewedById: reviewerId,
      };
      await tx.feedPost.update({ where: { id }, data });
      const decision = await tx.feedModerationDecision.create({
        data: {
          postId: id,
          revisionNumber: post.revisionNumber,
          status: dto.decision,
          recommendationStatus: data.recommendationStatus,
          policyCode: data.moderationPolicyCode,
          note: data.moderationNote,
          reviewerId,
          source: 'MANUAL',
        },
      });
      if (dto.decision === 'REJECTED' && dto.blockMedia) {
        const media = await tx.feedPostMedia.findMany({
          where: { postId: id, sha256: { not: null } },
          select: { sha256: true },
        });
        if (media.length)
          await tx.feedBlockedMedia.createMany({
            data: media.map((m) => ({
              sha256: m.sha256!,
              postId: id,
              revisionNumber: post.revisionNumber,
            })),
            skipDuplicates: true,
          });
      }
      await closeFeedReports(
        tx,
        id,
        post.revisionNumber,
        dto.decision === 'REJECTED'
          ? 'CONTENT_REMOVED'
          : dto.eligible
            ? 'NO_VIOLATION'
            : 'CONTENT_RESTRICTED',
        reviewerId,
        dto.note ?? 'Không phát hiện vi phạm.',
        dto.policyCode,
      );
      await notifyFeedAuthor(
        tx,
        post,
        'FEED_MODERATION_DECIDED',
        `${dto.decision === 'APPROVED' ? 'Bài đăng đã được duyệt.' : 'Bài đăng bị từ chối.'} ${dto.note ?? ''}${dto.decision === 'REJECTED' ? ' Bạn có thể khiếu nại trong 30 ngày.' : ''}`,
        decision.id,
      );
      await this.audit.record(
        {
          actorInternalAccountId: reviewerId,
          action: 'FEED_MODERATION_DECIDED',
          resourceType: 'FEED_POST',
          resourceId: id,
          result: 'SUCCESS',
          metadata: {
            revisionNumber: post.revisionNumber,
            decision: dto.decision,
          },
        },
        {},
        tx,
      );
      return { id, ...data };
    });
  }

  async history(id: string) {
    return {
      data: await this.prisma.feedModerationDecision.findMany({
        where: { postId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    };
  }

  async appeal(userId: string, id: string, dto: AppealFeedDto) {
    return this.prisma.$transaction(async (tx) => {
      const { actor } = await this.access.forPost(tx, userId, id);
      await this.access.lockPost(tx, id, actor);
      const post = await tx.feedPost.findUniqueOrThrow({ where: { id } });
      if (
        post.revisionNumber !== dto.revisionNumber ||
        post.moderationStatus !== 'REJECTED'
      )
        throw new ConflictException(
          'Chỉ khiếu nại phiên bản hiện tại bị từ chối.',
        );
      if (
        !post.moderationReviewedAt ||
        Date.now() - post.moderationReviewedAt.getTime() > 30 * 86400000
      )
        throw new ConflictException('Đã quá hạn khiếu nại 30 ngày.');
      const previous = await tx.feedModerationAppeal.findUnique({
        where: {
          postId_revisionNumber: {
            postId: id,
            revisionNumber: dto.revisionNumber,
          },
        },
      });
      if (previous)
        throw new ConflictException('Phiên bản này đã có khiếu nại.');
      return tx.feedModerationAppeal.create({
        data: {
          postId: id,
          revisionNumber: dto.revisionNumber,
          userId,
          reason: dto.reason,
        },
      });
    });
  }

  async appeals() {
    const rows = await this.prisma.feedModerationAppeal.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      include: {
        post: {
          select: {
            caption: true,
            revisionNumber: true,
            moderationNote: true,
            moderationPolicyCode: true,
            media: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    return {
      data: rows.map((a) => ({
        ...a,
        post: {
          ...a.post,
          media: a.post.media.map((m) => ({
            id: m.id,
            kind: m.kind,
            secureUrl: feedMediaUrl(m, this.mediaStorage),
          })),
        },
      })),
    };
  }

  async resolveAppeal(
    id: string,
    dto: ResolveFeedAppealDto,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const appeal = await tx.feedModerationAppeal.findUnique({
        where: { id },
      });
      if (!appeal) throw new NotFoundException('Không tìm thấy khiếu nại.');
      const post = await this.lock(tx, appeal.postId);
      if (post.moderationReviewedById === reviewerId)
        throw new ForbiddenException('Cần người khác xét lại quyết định.');
      if (
        post.revisionNumber !== appeal.revisionNumber ||
        post.moderationStatus !== 'REJECTED' ||
        (post.moderationReviewedAt !== null &&
          post.moderationReviewedAt > appeal.createdAt)
      )
        throw new ConflictException(
          'Bài đã thay đổi; không thể áp dụng quyết định cũ.',
        );
      const claimed = await tx.feedModerationAppeal.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: dto.decision,
          note: dto.note,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      if (!claimed.count)
        throw new ConflictException('Khiếu nại đã được xử lý.');
      const status =
        dto.decision === 'REVERSED'
          ? ('APPROVED' as const)
          : ('REJECTED' as const);
      const decision = await tx.feedModerationDecision.create({
        data: {
          postId: post.id,
          revisionNumber: post.revisionNumber,
          status,
          recommendationStatus: 'INELIGIBLE',
          policyCode: post.moderationPolicyCode,
          note: dto.note,
          reviewerId,
          source: 'APPEAL',
        },
      });
      if (dto.decision === 'REVERSED')
        await tx.feedBlockedMedia.updateMany({
          where: { postId: post.id, revisionNumber: post.revisionNumber },
          data: { active: false },
        });
      await tx.feedPost.update({
        where: { id: post.id },
        data: {
          moderationStatus: status,
          ...(dto.decision === 'REVERSED' &&
            post.status === 'HIDDEN' && { status: 'PUBLISHED' }),
          recommendationStatus: 'INELIGIBLE',
          moderationNote: dto.note,
          moderationReviewedById: reviewerId,
          moderationReviewedAt: new Date(),
        },
      });
      await notifyFeedAuthor(
        tx,
        post,
        'FEED_APPEAL_RESOLVED',
        `${dto.decision === 'REVERSED' ? 'Khiếu nại được chấp nhận.' : 'Quyết định trước được giữ nguyên.'} ${dto.note}`,
        decision.id,
      );
      await this.audit.record(
        {
          actorInternalAccountId: reviewerId,
          action: 'FEED_APPEAL_RESOLVED',
          resourceType: 'FEED_POST',
          resourceId: post.id,
          result: 'SUCCESS',
          metadata: { appealId: id, decision: dto.decision },
        },
        {},
        tx,
      );
      return { id, status: dto.decision };
    });
  }
}
