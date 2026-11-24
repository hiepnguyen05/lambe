import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { FeedAccessService } from './organization/feed-access.service';
import { feedNotice } from './feed-notices';
import { publicFeedWhere } from '../domain/feed-visibility.policy';
import { ReportFeedPostDto } from '../dto/feed.dto';
import { canReadFeedNotice } from './feed-notice-access';

@Injectable()
export class FeedOperationsService {
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: FeedAccessService,
  ) {}
  async notices(userId: string) {
    const scope = await this.access.managedScope(userId);
    const rows = await this.prisma.feedNotice.findMany({
      where: {
        userId,
        OR: [{ managed: false }, { managed: true, post: scope }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        postId: true,
        event: true,
        detail: true,
        managed: true,
        readAt: true,
        createdAt: true,
      },
    });
    return { data: rows };
  }
  async readNotice(userId: string, id: string) {
    const row = await this.prisma.feedNotice.findFirst({
      where: { id, userId },
    });
    if (!row || !(await canReadFeedNotice(this.prisma, id, userId)))
      throw new NotFoundException('Không tìm thấy thông báo.');
    await this.prisma.feedNotice.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }
  async reportComment(
    userId: string,
    commentId: string,
    dto: ReportFeedPostDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM feed_comments WHERE id=${commentId} FOR SHARE`,
      );
      const comment = await tx.feedComment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
          moderationHidden: false,
          post: publicFeedWhere,
        },
        select: { id: true, userId: true },
      });
      if (!comment)
        throw new NotFoundException('Bình luận không còn hiển thị.');
      if (comment.userId === userId)
        throw new BadRequestException('Không tự báo cáo bình luận.');
      await tx.feedCommentReport.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId, reason: dto.reason, detail: dto.detail },
        update: {},
      });
      return { reported: true };
    });
  }
  async commentReports() {
    return {
      data: await this.prisma.feedCommentReport.findMany({
        where: { resolution: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
        select: {
          id: true,
          reason: true,
          detail: true,
          createdAt: true,
          comment: {
            select: {
              id: true,
              postId: true,
              text: true,
              moderationHidden: true,
            },
          },
        },
      }),
    };
  }
  async resolveComment(
    id: string,
    hide: boolean,
    note: string,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.feedCommentReport.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Không tìm thấy báo cáo.');
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM feed_comments WHERE id=${report.commentId} FOR UPDATE`,
      );
      if (
        (await tx.feedCommentReport.findUniqueOrThrow({ where: { id } }))
          .resolution
      )
        throw new ConflictException('Báo cáo đã được xử lý.');
      const comment = await tx.feedComment.findUniqueOrThrow({
        where: { id: report.commentId },
      });
      if (hide)
        await tx.feedComment.update({
          where: { id: comment.id },
          data: { moderationHidden: true },
        });
      const detail = `Báo cáo bình luận đã được xử lý: ${hide ? 'Nội dung được ẩn' : 'Không phát hiện vi phạm'}.`;
      await tx.$executeRaw(Prisma.sql`INSERT INTO feed_notices(id,"userId","postId",event,"sourceKey",detail,managed)
        SELECT gen_random_uuid()::text,r."userId",${comment.postId},'FEED_REPORT_RESOLVED','comment-report:' || r.id,${detail},false
        FROM feed_comment_reports r WHERE r."commentId"=${comment.id} AND r.resolution IS NULL
        ON CONFLICT ("sourceKey") DO NOTHING`);
      await tx.feedCommentReport.updateMany({
        where: { commentId: comment.id, resolution: null },
        data: {
          resolution: hide ? 'CONTENT_REMOVED' : 'NO_VIOLATION',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          note,
        },
      });
      await this.audit.record(
        {
          actorInternalAccountId: reviewerId,
          action: 'FEED_COMMENT_REVIEWED',
          resourceType: 'FEED_COMMENT',
          resourceId: comment.id,
          result: 'SUCCESS',
          metadata: { hide },
        },
        {},
        tx,
      );
      return { id, resolved: true };
    });
  }
  async restrict(
    providerId: string,
    blocked: boolean,
    note: string,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.providerProfile.update({
        where: { id: providerId },
        data: {
          feedPostingBlocked: blocked,
          feedPostingBlockReason: blocked ? note : null,
        },
      });
      await this.audit.record(
        {
          actorInternalAccountId: reviewerId,
          action: 'FEED_POSTING_RESTRICTED',
          resourceType: 'PROVIDER',
          resourceId: providerId,
          result: 'SUCCESS',
          metadata: { blocked, note },
        },
        {},
        tx,
      );
      return { providerId, blocked };
    });
  }
  async metrics() {
    const [resolved, latency] = await Promise.all([
      this.prisma.feedModerationAppeal.count({
        where: { status: { in: ['UPHELD', 'REVERSED'] } },
      }),
      this.prisma.$queryRaw<{ seconds: number | null }[]>(
        Prisma.sql`SELECT AVG(GREATEST(0,EXTRACT(EPOCH FROM (d."createdAt"-p."createdAt"))))::float8 AS seconds FROM feed_moderation_decisions d JOIN feed_posts p ON p.id=d."postId" WHERE d.source='MANUAL' AND d."revisionNumber"=1`,
      ),
    ]);
    const [pending, oldest, decisions, reversed, violations] =
      await Promise.all([
        this.prisma.feedPost.count({
          where: { moderationStatus: 'PENDING', status: { not: 'DELETED' } },
        }),
        this.prisma.feedPost.findFirst({
          where: { moderationStatus: 'PENDING', status: { not: 'DELETED' } },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.feedModerationDecision.count({
          where: { source: 'MANUAL' },
        }),
        this.prisma.feedModerationAppeal.count({
          where: { status: 'REVERSED' },
        }),
        this.prisma.feedModerationDecision.groupBy({
          by: ['postId'],
          where: { status: 'REJECTED' },
          _count: true,
          take: 50,
          orderBy: { postId: 'asc' },
        }),
      ]);
    return {
      averageInitialReviewSeconds: latency[0]?.seconds ?? 0,
      reversalRate: resolved ? reversed / resolved : 0,
      pending,
      oldestAgeSeconds: oldest
        ? Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1000)
        : 0,
      manualDecisions: decisions,
      reversedAppeals: reversed,
      violationHistory: violations,
    };
  }
  @Interval(10000)
  async relay() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM feed_notices WHERE "transportQueuedAt" IS NULL ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED`,
        );
        for (const { id } of rows) {
          const n = await tx.feedNotice.findUniqueOrThrow({ where: { id } });
          await feedNotice(tx, {
            userId: n.userId,
            postId: n.postId,
            event: n.event,
            sourceKey: n.sourceKey,
            detail: n.detail,
            managed: n.managed,
          });
        }
      });
    } finally {
      this.running = false;
    }
  }
}
