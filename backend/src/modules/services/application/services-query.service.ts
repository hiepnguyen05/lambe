import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { PublicServiceQueryDto } from '../dto/public-service-query.dto';
import type { ServiceQueryDto } from '../dto/service-query.dto';
import { adminServiceSelect, publicServiceSelect } from './service.select';
import { ServiceCacheService } from './service-cache.service';

export interface PublicServiceCacheItem {
  id: string;
  name: string;
  description: string | null;
  minPriceAmount: number;
  targetAudience: string;
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
  category: { slug: string };
}

const publicServiceReviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  memberId: true,
  memberDisplayName: true,
  memberAvatarUrl: true,
  customer: {
    select: {
      fullName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.OrderReviewSelect;

type SelectedServiceReview = Prisma.OrderReviewGetPayload<{
  select: typeof publicServiceReviewSelect;
}>;

function presentServiceReview(r: SelectedServiceReview) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    customerName: r.customer?.fullName ?? 'Khách hàng',
    customerAvatar: r.customer?.avatarUrl ?? null,
    assignedMember: r.memberId
      ? {
          id: r.memberId,
          displayName: r.memberDisplayName,
          avatarUrl: r.memberAvatarUrl,
        }
      : null,
  };
}

@Injectable()
export class ServicesQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ServiceCacheService,
  ) {}

  async findAllForAdmin(query: ServiceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ServiceWhereInput = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.targetAudience) where.targetAudience = query.targetAudience;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: adminServiceSelect,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      success: true,
      data: services,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneForAdmin(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: adminServiceSelect,
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ.');
    return { success: true, data: service };
  }

  async findActive(query: PublicServiceQueryDto) {
    let services = await this.cache.getActive<PublicServiceCacheItem[]>();
    if (!services) {
      services = await this.prisma.service.findMany({
        where: {
          status: ServiceStatus.ACTIVE,
          category: { status: ServiceCategoryStatus.ACTIVE },
        },
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: publicServiceSelect,
      });
      await this.cache.setActive(services);
    }

    const normalizedSearch = query.search?.trim().toLocaleLowerCase('vi-VN');
    const filtered = services.filter((service) => {
      if (query.categorySlug && service.category.slug !== query.categorySlug) {
        return false;
      }
      if (
        query.targetAudience &&
        service.targetAudience !== query.targetAudience &&
        service.targetAudience !== 'ALL'
      ) {
        return false;
      }
      if (
        query.maxPriceAmount !== undefined &&
        service.minPriceAmount > query.maxPriceAmount
      ) {
        return false;
      }
      if (
        normalizedSearch &&
        !`${service.name} ${service.description ?? ''}`
          .toLocaleLowerCase('vi-VN')
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
    const summaries = await this.loadServiceReviewSummaries(
      filtered.map((item) => item.id).filter(Boolean),
    );
    const data = summaries
      ? filtered.map((service) => ({
          ...service,
          reviewSummary: summaries.get(service.id) ?? {
            count: 0,
            averageRating: null,
          },
        }))
      : filtered;
    return { success: true, data };
  }

  async findActiveBySlug(slug: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        slug,
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
      select: publicServiceSelect,
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ.');

    const aggregateFn = this.prisma.orderReview?.aggregate;
    const findManyFn = this.prisma.orderReview?.findMany;
    if (typeof aggregateFn !== 'function' || typeof findManyFn !== 'function') {
      return { success: true, data: service };
    }

    const reviewWhere: Prisma.OrderReviewWhereInput = {
      order: { providerService: { serviceId: service.id } },
    };
    const [reviewSummary, recentReviews] = await Promise.all([
      this.prisma.orderReview.aggregate({
        where: reviewWhere,
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.orderReview.findMany({
        where: reviewWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: publicServiceReviewSelect,
      }),
    ]);

    return {
      success: true,
      data: {
        ...service,
        reviewSummary: {
          count: reviewSummary._count.id,
          averageRating: reviewSummary._avg.rating,
        },
        reviews: recentReviews.map(presentServiceReview),
      },
    };
  }

  async findReviewsBySlug(slug: string, cursor?: string, limit = 20) {
    const service = await this.prisma.service.findFirst({
      where: {
        slug,
        status: ServiceStatus.ACTIVE,
        category: { status: ServiceCategoryStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ.');

    const aggregateFn = this.prisma.orderReview?.aggregate;
    const findManyFn = this.prisma.orderReview?.findMany;
    if (typeof aggregateFn !== 'function' || typeof findManyFn !== 'function') {
      return {
        success: true,
        data: {
          count: 0,
          averageRating: null,
          reviews: [],
          nextCursor: null,
        },
      };
    }

    const safeLimit = Math.min(50, Math.max(1, limit || 20));
    const baseWhere: Prisma.OrderReviewWhereInput = {
      order: { providerService: { serviceId: service.id } },
    };

    let boundary: { id: string; createdAt: Date } | null = null;
    if (cursor) {
      boundary = await this.prisma.orderReview.findFirst({
        where: { AND: [baseWhere, { id: cursor }] },
        select: { id: true, createdAt: true },
      });
    }

    const pagedWhere: Prisma.OrderReviewWhereInput = boundary
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: boundary.createdAt } },
                { createdAt: boundary.createdAt, id: { lt: boundary.id } },
              ],
            },
          ],
        }
      : baseWhere;

    const [reviewSummary, rows] = await Promise.all([
      this.prisma.orderReview.aggregate({
        where: baseWhere,
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.orderReview.findMany({
        where: pagedWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: safeLimit + 1,
        select: publicServiceReviewSelect,
      }),
    ]);

    const pageRows = rows.slice(0, safeLimit);
    return {
      success: true,
      data: {
        count: reviewSummary._count.id,
        averageRating: reviewSummary._avg.rating,
        reviews: pageRows.map(presentServiceReview),
        nextCursor: rows.length > safeLimit ? (pageRows.at(-1)?.id ?? null) : null,
      },
    };
  }

  private async loadServiceReviewSummaries(serviceIds: readonly string[]) {
    if (typeof this.prisma.$queryRaw !== 'function') {
      return null;
    }
    const uniqueIds = [...new Set(serviceIds)];
    const map = new Map<
      string,
      { count: number; averageRating: number | null }
    >(uniqueIds.map((id) => [id, { count: 0, averageRating: null }]));
    if (uniqueIds.length === 0) return map;

    const rows = await this.prisma.$queryRaw<
      Array<{ serviceId: string; count: number; averageRating: number | null }>
    >(Prisma.sql`
      SELECT
        ps."serviceId" AS "serviceId",
        COUNT(r.id)::int AS count,
        AVG(r.rating)::float AS "averageRating"
      FROM "order_reviews" r
      INNER JOIN "service_orders" o ON o.id = r."orderId"
      INNER JOIN "provider_services" ps ON ps.id = o."providerServiceId"
      WHERE ps."serviceId" IN (${Prisma.join(uniqueIds)})
      GROUP BY ps."serviceId"
    `);
    for (const row of rows) {
      map.set(row.serviceId, {
        count: Number(row.count) || 0,
        averageRating:
          row.averageRating === null || row.averageRating === undefined
            ? null
            : Number(row.averageRating),
      });
    }
    return map;
  }
}
