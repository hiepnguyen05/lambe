import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { FeedSafetyService } from './feed-safety.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { publicFeedWhere } from '../domain/feed-visibility.policy';
import type { FeedEngagementDto } from '../dto/feed-engagement.dto';
import { FeedQueryService } from './feed-query.service';

@Injectable()
export class FeedRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: FeedQueryService,
    private readonly config: ConfigService,
    @Optional() private readonly safety?: FeedSafetyService,
  ) {}

  async engage(userId: string, postId: string, dto: FeedEngagementDto) {
    if (!this.config.get<boolean>('cache.feedRecommendationsEnabled', false))
      return { recorded: false };
    const post = await this.prisma.feedPost.findFirst({
      where: { id: postId, ...publicFeedWhere },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng.');
    await this.prisma.feedEngagement.upsert({
      where: {
        userId_clientEventId: { userId, clientEventId: dto.clientEventId },
      },
      create: {
        userId,
        postId,
        clientEventId: dto.clientEventId,
        kind: dto.kind,
        durationMs: dto.durationMs,
      },
      update: {},
    });
    if (dto.kind === 'VIEW') await this.safety?.flagEngagement(postId);
    return { recorded: true };
  }

  async recommend(userId: string) {
    if (!this.config.get<boolean>('cache.feedRecommendationsEnabled', false))
      throw new NotFoundException('Gợi ý Feed chưa được bật.');
    const [profile, follows, recent, candidates] = await Promise.all([
      this.prisma.customerProfile.findUnique({
        where: { userId },
        select: {
          categoryInterests: { take: 20, select: { categoryId: true } },
          serviceInterests: { take: 20, select: { serviceId: true } },
        },
      }),
      this.prisma.providerFollow.findMany({
        where: { userId },
        take: 100,
        select: { providerId: true },
      }),
      this.prisma.feedEngagement.findMany({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { postId: true, kind: true, durationMs: true },
      }),
      this.prisma.feedPost.findMany({
        where: {
          ...publicFeedWhere,
          recommendationStatus: 'ELIGIBLE',
          reports: { none: { userId } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
        select: {
          id: true,
          providerId: true,
          createdAt: true,
          services: {
            where: {
              providerService: {
                status: 'ACTIVE',
                service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
              },
            },
            select: {
              providerService: {
                select: {
                  serviceId: true,
                  service: { select: { categoryId: true } },
                },
              },
            },
          },
          _count: { select: { likes: true, saves: true } },
        },
      }),
    ]);
    const followed = new Set(follows.map((item) => item.providerId));
    const categories = new Set(
      profile?.categoryInterests.map((item) => item.categoryId),
    );
    const services = new Set(
      profile?.serviceInterests.map((item) => item.serviceId),
    );
    const signals = new Map<string, number>();
    for (const event of recent) {
      const weight =
        event.kind === 'SKIP'
          ? -2
          : event.kind === 'START_BOOKING'
            ? 5
            : event.kind === 'OPEN_SERVICE'
              ? 3
              : event.kind === 'DWELL'
                ? Math.min(1, (event.durationMs ?? 0) / 30000)
                : 0;
      signals.set(
        event.postId,
        Math.max(-5, Math.min(5, (signals.get(event.postId) ?? 0) + weight)),
      );
    }
    const ranked = candidates
      .filter((post) => post.services.length > 0)
      .map((post) => ({
        post,
        score:
          1 /
            (1 +
              Math.max(0, Date.now() - post.createdAt.getTime()) / 86400000) +
          (followed.has(post.providerId) ? 3 : 0) +
          (post.services.some((link) =>
            services.has(link.providerService.serviceId),
          )
            ? 3
            : 0) +
          (post.services.some((link) =>
            categories.has(link.providerService.service.categoryId),
          )
            ? 2
            : 0) +
          Math.min(
            2,
            Math.log1p(post._count.likes + post._count.saves * 2) / 5,
          ) +
          (signals.get(post.id) ?? 0),
      }))
      .sort((a, b) => b.score - a.score || b.post.id.localeCompare(a.post.id));
    const perProvider = new Map<string, number>();
    const chosen = ranked
      .filter(({ post }) => {
        const count = perProvider.get(post.providerId) ?? 0;
        if (count >= 2) return false;
        perProvider.set(post.providerId, count + 1);
        return true;
      })
      .slice(0, 20);
    const data = await this.queries.publicBatch(
      chosen.map(({ post }) => post.id),
      userId,
      true,
    );
    return { data, nextCursor: null, strategy: 'rules-v1' };
  }
}
