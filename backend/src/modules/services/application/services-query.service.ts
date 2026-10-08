import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { PublicServiceQueryDto } from '../dto/public-service-query.dto';
import type { ServiceQueryDto } from '../dto/service-query.dto';
import { adminServiceSelect, publicServiceSelect } from './service.select';
import { ServiceCacheService } from './service-cache.service';

export interface PublicServiceCacheItem {
  name: string;
  description: string | null;
  minPriceAmount: number;
  targetAudience: string;
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
  category: { slug: string };
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

    const [services, total] = await this.prisma.$transaction([
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
    const data = services.filter((service) => {
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
    return { success: true, data: service };
  }
}
