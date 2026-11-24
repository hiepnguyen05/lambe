import { Injectable, Optional } from '@nestjs/common';
import { CloudinaryService } from '../../../infrastructure/upload/cloudinary.service';
import { feedMediaUrl } from '../../social-feed/application/feed-media-url';
import { publicFeedWhere } from '../../social-feed/domain/feed-visibility.policy';
import {
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import { normalizeName } from '../../../common/utils/text-normalizer';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class AiRecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly media?: CloudinaryService,
  ) {}

  async services(terms: string[], message: string) {
    const queries = [...terms, message]
      .map(normalizeName)
      .filter((value) => value.length >= 3);
    const tokens = [
      ...new Set(queries.flatMap((value) => value.split(/[^a-z0-9]+/))),
    ]
      .filter((value) => value.length >= 3)
      .slice(0, 12);
    if (!tokens.length) return [];
    const candidates = await this.prisma.service.findMany({
      where: {
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
        OR: tokens.map((token) => ({ normalizedName: { contains: token } })),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        normalizedName: true,
        minPriceAmount: true,
        maxPriceAmount: true,
        currencyCode: true,
      },
      take: 100,
    });
    return candidates
      .map((item) => ({
        item,
        score: queries.reduce((score, query) => {
          const overlap = item.normalizedName
            .split(/[^a-z0-9]+/)
            .filter(
              (word) =>
                word.length >= 3 && query.split(/[^a-z0-9]+/).includes(word),
            ).length;
          return (
            score + overlap + (query.includes(item.normalizedName) ? 3 : 0)
          );
        }, 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ item: { normalizedName, ...service } }) => {
        void normalizedName;
        return service;
      });
  }

  async posts(serviceIds: string[], postIds?: string[]) {
    if (!serviceIds.length) return [];
    const rows = await this.prisma.feedPost.findMany({
      where: {
        ...publicFeedWhere,
        recommendationStatus: 'ELIGIBLE',
        ...(postIds ? { id: { in: postIds } } : {}),
        provider: {
          status: ProviderProfileStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE },
        },
        services: {
          some: {
            providerService: {
              status: ProviderServiceStatus.ACTIVE,
              serviceId: { in: serviceIds },
              service: {
                status: ServiceStatus.ACTIVE,
                category: { status: ServiceCategoryStatus.ACTIVE },
              },
            },
          },
        },
      },
      select: {
        id: true,
        provider: { select: { id: true, displayName: true, avatarUrl: true } },
        media: {
          orderBy: { position: 'asc' },
          take: 1,
          select: {
            kind: true,
            secureUrl: true,
            publicId: true,
            format: true,
            deliveryType: true,
          },
        },
        services: {
          where: {
            providerService: {
              status: ProviderServiceStatus.ACTIVE,
              serviceId: { in: serviceIds },
              service: {
                status: ServiceStatus.ACTIVE,
                category: { status: ServiceCategoryStatus.ACTIVE },
              },
            },
          },
          take: 1,
          select: {
            providerService: {
              select: { service: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: postIds ? Math.min(postIds.length, 300) : 6,
    });
    return rows.flatMap((post) => {
      const media = post.media[0];
      const service = post.services[0]?.providerService.service;
      if (!media || !service || !media.secureUrl.startsWith('https://'))
        return [];
      return [
        {
          id: post.id,
          provider: post.provider,
          service,
          mediaKind: media.kind,
          thumbnailUrl:
            media.kind === 'IMAGE' ? feedMediaUrl(media, this.media) : null,
          mediaUrl: feedMediaUrl(media, this.media),
        },
      ];
    });
  }
}
