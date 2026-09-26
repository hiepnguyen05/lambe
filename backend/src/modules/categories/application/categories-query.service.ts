import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceCategoryStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { CategoryQueryDto } from '../dto/category-query.dto';
import { adminCategorySelect, publicCategorySelect } from './category.select';
import { CategoryCacheService } from './category-cache.service';

@Injectable()
export class CategoriesQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CategoryCacheService,
  ) {}

  async findAllForAdmin(query: CategoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ServiceCategoryWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: adminCategorySelect,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    return {
      success: true,
      data: categories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      select: adminCategorySelect,
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
    }

    return { success: true, data: category };
  }

  async findActive() {
    const cached = await this.cache.getActive<unknown[]>();
    if (cached) {
      return { success: true, data: cached };
    }

    const categories = await this.prisma.serviceCategory.findMany({
      where: { status: ServiceCategoryStatus.ACTIVE },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: publicCategorySelect,
    });

    await this.cache.setActive(categories);

    return { success: true, data: categories };
  }

  async findActiveBySlug(slug: string) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        slug,
        status: ServiceCategoryStatus.ACTIVE,
      },
      select: publicCategorySelect,
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục dịch vụ.');
    }

    return { success: true, data: category };
  }
}
