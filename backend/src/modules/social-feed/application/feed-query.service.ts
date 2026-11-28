import {
  BadRequestException,
  Injectable,
  Inject,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedPostStatus,
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedListQueryDto, ManagedFeedQueryDto } from '../dto/feed.dto';
import { FeedAccessService } from './organization/feed-access.service';
import {
  FEED_MEDIA_STORAGE,
  type FeedMediaStorage,
} from './feed-media-storage.port';
import { feedMediaUrl } from './feed-media-url';
import { publicFeedWhere } from '../domain/feed-visibility.policy';
import {
  FeedLiveReadService,
  type LivePublicPost,
} from './feed-live-read.service';
import {
  FeedCacheService,
  type CachedPublicFeedPost,
} from './feed-cache.service';

const postInclude = {
  provider: { select: { id: true, displayName: true, avatarUrl: true } },
  media: { orderBy: { position: 'asc' as const } },
  services: {
    where: {
      providerService: {
        status: ProviderServiceStatus.ACTIVE,
        service: {
          status: ServiceStatus.ACTIVE,
          category: { status: 'ACTIVE' },
        },
      },
    },
    include: {
      providerService: {
        select: {
          id: true,
          priceAmount: true,
          durationMinutes: true,
          status: true,
          service: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: { select: { slug: true } },
            },
          },
        },
      },
    },
  },
  _count: { select: { likes: true, comments: true, saves: true } },
} satisfies Prisma.FeedPostInclude;

const publicLiveSelect = {
  id: true,
  providerId: true,
  status: true,
  revisionNumber: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FeedPostSelect;

@Injectable()
export class FeedQueryService {
  @Optional()
  @Inject(FEED_MEDIA_STORAGE)
  private readonly mediaStorage?: FeedMediaStorage;
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FeedAccessService,
    private readonly cache: FeedCacheService,
    private readonly liveRead: FeedLiveReadService,
  ) {}

  async list(
    query: FeedListQueryDto | ManagedFeedQueryDto,
    userId?: string,
    mode: 'all' | 'following' | 'saved' | 'mine' = 'all',
  ) {
    const limit = query.limit ?? 20;
    const scope =
      mode === 'mine'
        ? await this.access.managedScope(userId!)
        : publicFeedWhere;
    const managed = query as ManagedFeedQueryDto;
    const andFilters: Prisma.FeedPostWhereInput[] = [scope];
    if (query.serviceId) {
      andFilters.push({
        services: { some: { providerService: { serviceId: query.serviceId } } },
      });
    }
    const categorySlug = query.categorySlug?.trim();
    if (query.categoryId || categorySlug) {
      andFilters.push({
        services: {
          some: {
            providerService: {
              ...(mode !== 'mine' && { status: ProviderServiceStatus.ACTIVE }),
              service: {
                ...(mode !== 'mine' && { status: ServiceStatus.ACTIVE }),
                category: {
                  ...(mode !== 'mine' && { status: 'ACTIVE' }),
                  ...(query.categoryId && { id: query.categoryId }),
                  ...(categorySlug && { slug: categorySlug }),
                },
              },
            },
          },
        },
      });
    }
    const searchTerm = query.search?.trim();
    if (searchTerm) {
      andFilters.push({
        OR: [
          { caption: { contains: searchTerm, mode: 'insensitive' } },
          {
            provider: {
              displayName: { contains: searchTerm, mode: 'insensitive' },
            },
          },
          { authorDisplayName: { contains: searchTerm, mode: 'insensitive' } },
          {
            services: {
              some: {
                providerService: {
                  ...(mode !== 'mine' && {
                    status: ProviderServiceStatus.ACTIVE,
                  }),
                  service: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
          },
        ],
      });
    }
    const where: Prisma.FeedPostWhereInput = {
      AND: andFilters,
      ...(mode === 'mine' && {
        status: { not: FeedPostStatus.DELETED },
        ...(managed.organizationReviewStatus && {
          organizationReviewStatus: managed.organizationReviewStatus,
        }),
        ...(managed.authorMemberId && {
          authorMemberId: managed.authorMemberId,
        }),
      }),
      ...(query.providerId && { providerId: query.providerId }),
      ...(mode === 'following' &&
        userId && {
          provider: {
            status: ProviderProfileStatus.ACTIVE,
            followers: { some: { userId } },
          },
        }),
      ...(mode === 'saved' && userId && { saves: { some: { userId } } }),
    };
    if (query.cursor) {
      const anchor = await this.prisma.feedPost.findFirst({
        where: { AND: [where, { id: query.cursor }] },
        select: { createdAt: true },
      });
      if (!anchor) throw new BadRequestException('Cursor không hợp lệ.');
      where.OR = [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: query.cursor } },
      ];
    }
    if (mode === 'all' && this.cache.isEnabled()) {
      const identities = await this.prisma.feedPost.findMany({
        where,
        select: publicLiveSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      const pageIdentities = identities.slice(0, limit);
      const rows = await this.liveRead.load(
        pageIdentities.map((post) => post.id),
      );
      return {
        data: await this.hydratePublic(rows, userId),
        nextCursor:
          identities.length > limit
            ? (pageIdentities.at(-1)?.id ?? null)
            : null,
      };
    }
    const rows = await this.prisma.feedPost.findMany({
      where,
      include: postInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const flags =
      userId && page.length
        ? await this.viewerFlags(
            userId,
            page.map((post) => post.id),
            page.map((post) => post.providerId),
          )
        : undefined;
    return {
      data: page.map((post) =>
        this.present(
          post,
          flags?.liked.has(post.id) ?? false,
          flags?.saved.has(post.id) ?? false,
          flags?.followed.has(post.providerId) ?? false,
          mode === 'mine',
        ),
      ),
      nextCursor: rows.length > limit ? page.at(-1)?.id : null,
    };
  }

  async detail(id: string, userId?: string) {
    if (this.cache.isEnabled()) {
      const live = await this.prisma.feedPost.findFirst({
        where: { id, ...publicFeedWhere },
        select: publicLiveSelect,
      });
      if (!live) throw new NotFoundException('Không tìm thấy bài đăng.');
      const current = await this.liveRead.load([live.id]);
      const [post] = await this.hydratePublic(current, userId, 'detail');
      if (!post) throw new NotFoundException('Không tìm thấy bài đăng.');
      return post;
    }
    const post = await this.prisma.feedPost.findFirst({
      where: {
        id,
        ...publicFeedWhere,
      },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng.');
    const flags = userId
      ? await this.viewerFlags(userId, [id], [post.providerId])
      : undefined;
    return this.present(
      post,
      flags?.liked.has(id) ?? false,
      flags?.saved.has(id) ?? false,
      flags?.followed.has(post.providerId) ?? false,
    );
  }

  async publicBatch(ids: string[], userId: string, recommendedOnly = false) {
    const unique = [...new Set(ids)].slice(0, 50);
    if (!unique.length) return [];
    const rows = await this.prisma.feedPost.findMany({
      where: {
        ...publicFeedWhere,
        id: { in: unique },
        ...(recommendedOnly && { recommendationStatus: 'ELIGIBLE' }),
      },
      select: publicLiveSelect,
    });
    const valid = new Set(rows.map((row) => row.id));
    const ordered = unique.filter((id) => valid.has(id));
    return this.hydratePublic(await this.liveRead.load(ordered), userId);
  }

  async ownedDetail(id: string, userId: string) {
    const scope = await this.access.managedScope(userId);
    const post = await this.prisma.feedPost.findFirst({
      where: {
        id,
        status: { not: FeedPostStatus.DELETED },
        AND: [scope],
      },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng của bạn.');
    return this.present(post, false, false, false, true);
  }

  async comments(postId: string, cursor?: string, limit = 20) {
    await this.detail(postId);
    let boundary: { id: string; createdAt: Date } | undefined;
    if (cursor) {
      const found = await this.prisma.feedComment.findFirst({
        where: { id: cursor, postId, parentId: null },
        select: { id: true, createdAt: true },
      });
      if (!found) throw new BadRequestException('Cursor không hợp lệ.');
      boundary = found;
    }
    const rows = await this.prisma.feedComment.findMany({
      where: {
        postId,
        parentId: null,
        ...(boundary && {
          OR: [
            { createdAt: { gt: boundary.createdAt } },
            { createdAt: boundary.createdAt, id: { gt: boundary.id } },
          ],
        }),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        replies: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 20,
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        _count: { select: { replies: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      data: page.map((row) => ({
        ...this.presentComment(row),
        replies: row.replies.map((reply) => this.presentComment(reply)),
        replyCount: row._count.replies,
      })),
      nextCursor: rows.length > limit ? page.at(-1)?.id : null,
    };
  }

  async replies(postId: string, parentId: string, cursor?: string, limit = 20) {
    await this.detail(postId);
    const parent = await this.prisma.feedComment.findFirst({
      where: { id: parentId, postId, parentId: null },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Không tìm thấy bình luận gốc.');
    let boundary: { id: string; createdAt: Date } | undefined;
    if (cursor) {
      const found = await this.prisma.feedComment.findFirst({
        where: { id: cursor, postId, parentId },
        select: { id: true, createdAt: true },
      });
      if (!found) throw new BadRequestException('Cursor không hợp lệ.');
      boundary = found;
    }
    const rows = await this.prisma.feedComment.findMany({
      where: {
        postId,
        parentId,
        ...(boundary && {
          OR: [
            { createdAt: { gt: boundary.createdAt } },
            { createdAt: boundary.createdAt, id: { gt: boundary.id } },
          ],
        }),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      data: page.map((reply) => this.presentComment(reply)),
      nextCursor: rows.length > limit ? page.at(-1)?.id : null,
    };
  }

  private async hydratePublic(
    rows: LivePublicPost[],
    userId?: string,
    source: 'list' | 'detail' = 'list',
  ) {
    if (!rows.length) return [];
    const cached = await this.cache.getMany(rows, source);
    const missing = rows.filter((_row, index) => !cached[index]);
    const loaded = missing.length
      ? await this.cache.coalesce(missing, () =>
          this.prisma.feedPost.findMany({
            where: {
              AND: [
                publicFeedWhere,
                { id: { in: missing.map((row) => row.id) } },
              ],
            },
            include: postInclude,
          }),
        )
      : [];
    const byId = new Map(loaded.map((post) => [post.id, post]));
    const flags = userId
      ? await this.viewerFlags(
          userId,
          rows.map((row) => row.id),
          rows.map((row) => row.providerId),
        )
      : undefined;
    const result = [];
    for (let index = 0; index < rows.length; index++) {
      let live = rows[index];
      let content = cached[index];
      if (!content) {
        const post = byId.get(live.id);
        if (!post) continue;
        // A concurrent edit may have committed since the initial live query.
        live = post;
        const presented = this.present(post, false, false, false);
        content = {
          id: post.id,
          revisionNumber: post.revisionNumber,
          caption: presented.caption,
          authorMember: presented.authorMember,
          media: presented.media,
        } satisfies CachedPublicFeedPost;
      }
      result.push({
        ...content,
        status: live.status,
        provider: live.provider,
        services: live.services.map(({ providerService }) => providerService),
        counts: {
          likes: live._count.likes,
          comments: live._count.comments,
          saves: live._count.saves,
        },
        viewer: {
          liked: flags?.liked.has(live.id) ?? false,
          saved: flags?.saved.has(live.id) ?? false,
          followed: flags?.followed.has(live.providerId) ?? false,
        },
        createdAt: live.createdAt,
        updatedAt: live.updatedAt,
        sharePath: `/feed/posts/${live.id}`,
      });
    }
    await Promise.all(
      loaded.map((post) => {
        const presented = this.present(post, false, false, false);
        return this.cache.set(post, {
          id: post.id,
          revisionNumber: post.revisionNumber,
          caption: presented.caption,
          authorMember: presented.authorMember,
          media: presented.media,
        });
      }),
    );
    return result;
  }

  private presentComment(row: {
    id: string;
    parentId: string | null;
    text: string;
    createdAt: Date;
    deletedAt: Date | null;
    moderationHidden?: boolean;
    user: { id: string; fullName: string | null; avatarUrl: string | null };
  }) {
    return {
      id: row.id,
      parentId: row.parentId,
      text: row.deletedAt || row.moderationHidden ? null : row.text,
      deleted: !!row.deletedAt || !!row.moderationHidden,
      createdAt: row.createdAt,
      user: row.user,
    };
  }

  private present(
    post: Prisma.FeedPostGetPayload<{ include: typeof postInclude }>,
    liked: boolean,
    saved: boolean,
    followed: boolean,
    managed = false,
  ) {
    return {
      id: post.id,
      status: post.status,
      caption: post.caption,
      provider: post.provider,
      authorMember: post.authorMemberId
        ? {
            id: post.authorMemberId,
            displayName: post.authorDisplayName,
            avatarUrl: post.authorAvatarUrl,
          }
        : null,
      revisionNumber: post.revisionNumber,
      ...(managed && {
        moderation: {
          status: post.moderationStatus,
          recommendationStatus: post.recommendationStatus,
          policyCode: post.moderationPolicyCode,
          note: post.moderationNote,
          reviewedAt: post.moderationReviewedAt,
        },
        organizationReview: {
          status: post.organizationReviewStatus,
          reviewedAt: post.organizationReviewedAt,
          note: post.organizationReviewNote,
        },
      }),
      media: post.media.map(
        ({
          id,
          kind,
          secureUrl,
          width,
          height,
          durationSeconds,
          position,
          publicId,
          format,
          deliveryType,
        }) => ({
          id,
          kind,
          url: feedMediaUrl(
            { secureUrl, publicId, format, kind, deliveryType },
            this.mediaStorage,
          ),
          width,
          height,
          durationSeconds,
          position,
        }),
      ),
      services: post.services.map(({ providerService }) => providerService),
      counts: {
        likes: post._count.likes,
        comments: post._count.comments,
        saves: post._count.saves,
      },
      viewer: { liked, saved, followed },
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      sharePath: `/feed/posts/${post.id}`,
    };
  }

  private async viewerFlags(
    userId: string,
    postIds: string[],
    providerIds: string[],
  ) {
    const [likes, saves, follows] = await Promise.all([
      this.prisma.feedLike.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.feedSave.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.providerFollow.findMany({
        where: { userId, providerId: { in: providerIds } },
        select: { providerId: true },
      }),
    ]);
    return {
      liked: new Set(likes.map((item) => item.postId)),
      saved: new Set(saves.map((item) => item.postId)),
      followed: new Set(follows.map((item) => item.providerId)),
    };
  }
}
