import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { FeedPostStatus, FeedReportResolution, Prisma } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { AdminFeedPostsQueryDto } from '../dto/feed.dto';
import { publicFeedWhere } from '../domain/feed-visibility.policy';
import { enforceFeedPost } from './feed-enforcement';
import {
  FEED_MEDIA_STORAGE,
  type FeedMediaStorage,
} from './feed-media-storage.port';
import { feedMediaUrl } from './feed-media-url';

@Injectable()
export class FeedModerationService {
  @Optional()
  @Inject(FEED_MEDIA_STORAGE)
  private readonly mediaStorage?: FeedMediaStorage;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async stats() {
    const [
      totalPosts,
      publishedPosts,
      hiddenPosts,
      pendingReports,
      totalLikes,
      totalComments,
    ] = await Promise.all([
      this.prisma.feedPost.count({
        where: { status: { not: FeedPostStatus.DELETED } },
      }),
      this.prisma.feedPost.count({
        where: publicFeedWhere,
      }),
      this.prisma.feedPost.count({
        where: { status: FeedPostStatus.HIDDEN },
      }),
      this.prisma.feedReport.count({ where: { resolution: null } }),
      this.prisma.feedLike.count(),
      this.prisma.feedComment.count({ where: { deletedAt: null } }),
    ]);
    return {
      totalPosts,
      publishedPosts,
      hiddenPosts,
      pendingReports,
      totalLikes,
      totalComments,
    };
  }

  async posts(query: AdminFeedPostsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FeedPostWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as FeedPostStatus;
    } else {
      where.status = { not: FeedPostStatus.DELETED };
    }

    if (query.providerId) {
      where.providerId = query.providerId;
    }

    if (query.hasReports) {
      where.reports = { some: { resolution: null } };
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { caption: { contains: term, mode: 'insensitive' } },
        { provider: { displayName: { contains: term, mode: 'insensitive' } } },
        { id: term },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.feedPost.findMany({
        where,
        include: {
          provider: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          authorMember: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          media: {
            select: {
              id: true,
              secureUrl: true,
              publicId: true,
              format: true,
              deliveryType: true,
              kind: true,
              width: true,
              height: true,
              durationSeconds: true,
              position: true,
            },
            orderBy: { position: 'asc' },
          },
          services: {
            include: {
              providerService: {
                select: {
                  id: true,
                  priceAmount: true,
                  durationMinutes: true,
                  service: { select: { id: true, name: true } },
                },
              },
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
              reports: true,
            },
          },
          reports: {
            where: { resolution: null },
            select: { id: true, reason: true, detail: true, createdAt: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.feedPost.count({ where }),
    ]);

    return {
      data: rows.map((post) => ({
        id: post.id,
        caption: post.caption,
        status: post.status,
        includesCustomer: post.includesCustomer,
        hasCustomerConsent: post.hasCustomerConsent,
        revisionNumber: post.revisionNumber,
        organizationReviewStatus: post.organizationReviewStatus,
        moderationStatus: post.moderationStatus,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        provider: post.provider,
        authorMember: post.authorMember,
        media: post.media.map((m) => ({
          ...m,
          secureUrl: feedMediaUrl(m, this.mediaStorage),
          publicId: undefined,
          deliveryType: undefined,
          format: undefined,
        })),
        services: post.services.map((s) => ({
          id: s.providerService.id,
          name: s.providerService.service.name,
          price: s.providerService.priceAmount,
          duration: s.providerService.durationMinutes,
        })),
        counts: {
          likes: post._count.likes,
          comments: post._count.comments,
          saves: post._count.saves,
          reports: post._count.reports,
        },
        unresolvedReportsCount: post.reports.length,
        unresolvedReports: post.reports,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async reports(limit = 30, reviewed = false) {
    const rows = await this.prisma.feedReport.findMany({
      where: { resolution: reviewed ? { not: null } : null },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        reviewedBy: {
          select: { id: true, username: true, fullName: true },
        },
        post: {
          select: {
            id: true,
            caption: true,
            status: true,
            providerId: true,
            provider: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            media: {
              select: {
                id: true,
                secureUrl: true,
                kind: true,
                publicId: true,
                format: true,
                deliveryType: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      data: rows.map((r) => ({
        ...r,
        post: {
          ...r.post,
          media: r.post.media.map((m) => ({
            id: m.id,
            kind: m.kind,
            secureUrl: feedMediaUrl(m, this.mediaStorage),
          })),
        },
      })),
    };
  }

  async setStatus(postId: string, status: FeedPostStatus, reviewerId: string) {
    if (
      status !== FeedPostStatus.HIDDEN &&
      status !== FeedPostStatus.PUBLISHED
    ) {
      throw new BadRequestException('Chỉ có thể ẩn hoặc hiện lại bài đăng.');
    }
    if (status === FeedPostStatus.HIDDEN)
      return this.prisma.$transaction((tx) =>
        enforceFeedPost(
          tx,
          this.audit,
          postId,
          reviewerId,
          'CONTENT_REMOVED',
          'OTHER',
          'Bài bị nền tảng ẩn; có thể khiếu nại trong 30 ngày.',
        ),
      );
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feedPost.updateMany({
        where: {
          id: postId,
          status: { not: FeedPostStatus.DELETED },
          ...(status === FeedPostStatus.PUBLISHED && {
            moderationStatus: 'APPROVED',
          }),
        },
        data: { status },
      });
      if (!updated.count)
        throw new NotFoundException('Không tìm thấy bài đăng.');
      await this.audit.record(
        {
          actorInternalAccountId: reviewerId,
          action: 'FEED_POST_STATUS_CHANGED',
          resourceType: 'FEED_POST',
          resourceId: postId,
          result: 'SUCCESS',
          metadata: { status },
        },
        {},
        tx,
      );
    });
    return { id: postId, status };
  }

  async resolveReport(
    reportId: string,
    resolution: FeedReportResolution,
    reviewerId: string,
    policyCode = 'OTHER',
    note = 'Báo cáo đã được người kiểm duyệt xem xét.',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.feedReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          postId: true,
          resolution: true,
          revisionNumber: true,
        },
      });
      if (!report) throw new NotFoundException('Không tìm thấy báo cáo.');
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM feed_posts WHERE id=${report.postId} FOR UPDATE`,
      );
      const current = await tx.feedReport.findUnique({
        where: { id: reportId },
        select: { resolution: true },
      });
      if (current?.resolution)
        throw new ConflictException('Báo cáo đã được xử lý.');
      if (report.resolution)
        throw new ConflictException('Báo cáo đã được xử lý.');
      const normalized =
        resolution === 'POST_HIDDEN'
          ? 'CONTENT_REMOVED'
          : resolution === 'DISMISSED'
            ? 'NO_VIOLATION'
            : resolution;
      await enforceFeedPost(
        tx,
        this.audit,
        report.postId,
        reviewerId,
        normalized,
        policyCode,
        note,
        report.revisionNumber,
      );
      return { id: reportId, resolution: normalized };
    });
  }
}
