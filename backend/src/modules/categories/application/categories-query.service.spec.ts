import { NotFoundException } from '@nestjs/common';
import { ServiceCategoryStatus } from '@prisma/client';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  createCategoriesTestContext,
  PUBLIC_CATEGORY,
} from '../testing/categories-test.factory';

describe('CategoriesQueryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a filtered and paginated admin list', async () => {
    const { queryService, serviceCategory } = createCategoriesTestContext();

    await expect(
      queryService.findAllForAdmin({
        search: ' t\u00f3c ',
        status: ServiceCategoryStatus.ACTIVE,
        page: 2,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [ADMIN_CATEGORY],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    const countInput = serviceCategory.count.mock.calls[0][0] as {
      where: { status: ServiceCategoryStatus; OR: unknown[] };
    };
    expect(countInput.where.status).toBe(ServiceCategoryStatus.ACTIVE);
    expect(countInput.where.OR).toHaveLength(4);
  });

  it('uses pagination defaults when DTO transformation is bypassed', async () => {
    const { queryService } = createCategoriesTestContext();

    await expect(queryService.findAllForAdmin({})).resolves.toMatchObject({
      meta: { page: 1, limit: 20 },
    });
  });

  it('returns one category for admin', async () => {
    const { queryService } = createCategoriesTestContext();

    await expect(
      queryService.findOneForAdmin(BASE_CATEGORY.id),
    ).resolves.toEqual({ success: true, data: BASE_CATEGORY });
  });

  it('rejects a missing category', async () => {
    const { queryService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      queryService.findOneForAdmin('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns active categories and populates the cache', async () => {
    const { queryService, serviceCategory, cache } =
      createCategoriesTestContext();
    serviceCategory.findMany.mockResolvedValue([PUBLIC_CATEGORY]);

    await expect(queryService.findActive()).resolves.toEqual({
      success: true,
      data: [PUBLIC_CATEGORY],
    });
    expect(serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ServiceCategoryStatus.ACTIVE },
      }),
    );
    expect(cache.set).toHaveBeenCalledWith('service-categories:active:v1', [
      PUBLIC_CATEGORY,
    ]);
  });

  it('returns active categories from cache without querying PostgreSQL', async () => {
    const { queryService, serviceCategory, cache } =
      createCategoriesTestContext();
    cache.get.mockResolvedValue([PUBLIC_CATEGORY]);

    await expect(queryService.findActive()).resolves.toEqual({
      success: true,
      data: [PUBLIC_CATEGORY],
    });
    expect(serviceCategory.findMany).not.toHaveBeenCalled();
  });

  it('returns an active category by slug', async () => {
    const { queryService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findFirst.mockResolvedValue(PUBLIC_CATEGORY);

    await expect(queryService.findActiveBySlug('toc')).resolves.toEqual({
      success: true,
      data: PUBLIC_CATEGORY,
    });
    expect(serviceCategory.findFirst).toHaveBeenCalledWith({
      where: { slug: 'toc', status: ServiceCategoryStatus.ACTIVE },
      select: expect.any(Object) as object,
    });
  });

  it('does not expose a missing or inactive category by slug', async () => {
    const { queryService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findFirst.mockResolvedValue(null);

    await expect(
      queryService.findActiveBySlug('hidden-category'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
