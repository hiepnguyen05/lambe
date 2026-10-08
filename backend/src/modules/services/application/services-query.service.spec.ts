import { NotFoundException } from '@nestjs/common';
import {
  ServiceCategoryStatus,
  ServiceStatus,
  ServiceTargetAudience,
} from '@prisma/client';
import {
  ADMIN_SERVICE,
  PUBLIC_SERVICE,
  createServicesTestContext,
} from '../testing/services-test.factory';

describe('ServicesQueryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a filtered paginated admin list', async () => {
    const { queryService, service } = createServicesTestContext();
    await expect(
      queryService.findAllForAdmin({
        categoryId: ADMIN_SERVICE.categoryId,
        status: ServiceStatus.ACTIVE,
        search: ' tóc ',
        page: 2,
        limit: 10,
      }),
    ).resolves.toMatchObject({
      success: true,
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('uses pagination defaults and returns admin detail', async () => {
    const { queryService } = createServicesTestContext();
    await expect(queryService.findAllForAdmin({})).resolves.toMatchObject({
      meta: { page: 1, limit: 20 },
    });
    await expect(
      queryService.findOneForAdmin(ADMIN_SERVICE.id),
    ).resolves.toEqual({ success: true, data: expect.any(Object) as object });
  });

  it('rejects missing admin detail', async () => {
    const { queryService, service } = createServicesTestContext();
    service.findUnique.mockResolvedValue(null);
    await expect(
      queryService.findOneForAdmin('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns and caches only active services under active categories', async () => {
    const { queryService, service, cache } = createServicesTestContext();
    service.findMany.mockResolvedValue([PUBLIC_SERVICE]);
    await expect(queryService.findActive({})).resolves.toEqual({
      success: true,
      data: [PUBLIC_SERVICE],
    });
    expect(service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ServiceStatus.ACTIVE,
          category: { status: ServiceCategoryStatus.ACTIVE },
        },
      }),
    );
    expect(cache.set).toHaveBeenCalledWith('services:active:v2', [
      PUBLIC_SERVICE,
    ]);
  });

  it('filters the cached public list by category slug', async () => {
    const { queryService, service, cache } = createServicesTestContext();
    cache.get.mockResolvedValue([
      PUBLIC_SERVICE,
      { ...PUBLIC_SERVICE, id: 'other', category: { slug: 'nail' } },
    ]);
    await expect(
      queryService.findActive({ categorySlug: 'toc' }),
    ).resolves.toEqual({ success: true, data: [PUBLIC_SERVICE] });
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it('filters public services by audience, search and affordable minimum', async () => {
    const { queryService, cache } = createServicesTestContext();
    const universal = {
      ...PUBLIC_SERVICE,
      id: 'universal',
      targetAudience: ServiceTargetAudience.ALL,
    };
    const womenOnly = {
      ...PUBLIC_SERVICE,
      id: 'women-only',
      targetAudience: ServiceTargetAudience.WOMEN,
    };
    const expensive = {
      ...PUBLIC_SERVICE,
      id: 'expensive',
      minPriceAmount: 500000,
    };
    cache.get.mockResolvedValue([
      PUBLIC_SERVICE,
      universal,
      womenOnly,
      expensive,
    ]);

    await expect(
      queryService.findActive({
        targetAudience: ServiceTargetAudience.MEN,
        search: 'cắt tóc',
        maxPriceAmount: 300000,
      }),
    ).resolves.toEqual({
      success: true,
      data: [PUBLIC_SERVICE, universal],
    });
  });

  it('returns an active service by slug and hides missing ones', async () => {
    const { queryService, service } = createServicesTestContext();
    service.findFirst.mockResolvedValue(PUBLIC_SERVICE);
    await expect(queryService.findActiveBySlug('cat-toc-nam')).resolves.toEqual(
      { success: true, data: PUBLIC_SERVICE },
    );

    service.findFirst.mockResolvedValue(null);
    await expect(
      queryService.findActiveBySlug('hidden-service'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
