import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceCategoryStatus, ServiceStatus } from '@prisma/client';
import {
  ADMIN_SERVICE,
  BASE_SERVICE,
  SERVICE_ACTOR,
  SERVICE_CATEGORY,
  createServicesTestContext,
} from '../testing/services-test.factory';

describe('ServicesCommandService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a normalized inactive service with a VND price range', async () => {
    const { commandService, service, auditLog, cache } =
      createServicesTestContext();

    await expect(
      commandService.create(
        {
          categoryId: SERVICE_CATEGORY.id,
          code: ' men_haircut ',
          name: ' Cắt tóc nam ',
          slug: ' cat-toc-nam ',
          minPriceAmount: 50000,
          maxPriceAmount: 300000,
          defaultDurationMinutes: 45,
        },
        SERVICE_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true, data: ADMIN_SERVICE });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'MEN_HAIRCUT',
          normalizedName: 'cat toc nam',
          currencyCode: 'VND',
          status: ServiceStatus.INACTIVE,
        }) as object,
      }),
    );
    expect(auditLog.create).toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith('services:active:v1');
  });

  it('rejects an inverted price range', async () => {
    const { commandService } = createServicesTestContext();
    await expect(
      commandService.create(
        {
          categoryId: SERVICE_CATEGORY.id,
          code: 'MEN_HAIRCUT',
          name: 'Cắt tóc nam',
          slug: 'cat-toc-nam',
          minPriceAmount: 300000,
          maxPriceAmount: 50000,
        },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creation in an archived category', async () => {
    const { commandService, serviceCategory } = createServicesTestContext();
    serviceCategory.findUnique.mockResolvedValue({
      ...SERVICE_CATEGORY,
      status: ServiceCategoryStatus.ARCHIVED,
    });
    await expect(
      commandService.create(
        {
          categoryId: SERVICE_CATEGORY.id,
          code: 'MEN_HAIRCUT',
          name: 'Cắt tóc nam',
          slug: 'cat-toc-nam',
          minPriceAmount: 50000,
          maxPriceAmount: 300000,
        },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creation when the category does not exist', async () => {
    const { commandService, serviceCategory } = createServicesTestContext();
    serviceCategory.findUnique.mockResolvedValue(null);
    await expect(
      commandService.create(
        {
          categoryId: SERVICE_CATEGORY.id,
          code: 'MEN_HAIRCUT',
          name: 'Cắt tóc nam',
          slug: 'cat-toc-nam',
          minPriceAmount: 50000,
          maxPriceAmount: 300000,
        },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate service identity', async () => {
    const { commandService, service } = createServicesTestContext();
    service.findFirst.mockResolvedValue(BASE_SERVICE);
    await expect(
      commandService.create(
        {
          categoryId: SERVICE_CATEGORY.id,
          code: 'MEN_HAIRCUT',
          name: 'Cắt tóc nam',
          slug: 'cat-toc-nam',
          minPriceAmount: 50000,
          maxPriceAmount: 300000,
        },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates the effective price range during a partial update', async () => {
    const { commandService } = createServicesTestContext();
    await expect(
      commandService.update(
        BASE_SERVICE.id,
        { minPriceAmount: 400000 },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty update and a missing service', async () => {
    const { commandService, service } = createServicesTestContext();
    await expect(
      commandService.update(BASE_SERVICE.id, {}, SERVICE_ACTOR.id),
    ).rejects.toBeInstanceOf(BadRequestException);

    service.findUnique.mockResolvedValue(null);
    await expect(
      commandService.update(
        BASE_SERVICE.id,
        { name: 'Tên mới' },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates price limits and writes an audit snapshot', async () => {
    const { commandService, service, auditLog } = createServicesTestContext();
    service.update.mockResolvedValue({
      ...ADMIN_SERVICE,
      minPriceAmount: 70000,
      maxPriceAmount: 350000,
    });
    await expect(
      commandService.update(
        BASE_SERVICE.id,
        { minPriceAmount: 70000, maxPriceAmount: 350000 },
        SERVICE_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true });
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minPriceAmount: 70000,
          maxPriceAmount: 350000,
        }) as object,
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'SERVICE_UPDATED' }) as object,
    });
  });

  it('updates all editable content fields', async () => {
    const { commandService, service } = createServicesTestContext();
    await commandService.update(
      BASE_SERVICE.id,
      {
        name: ' Cắt tóc nam cao cấp ',
        slug: ' cat-toc-nam-cao-cap ',
        description: ' Mô tả ',
        iconUrl: ' content_cut ',
        defaultDurationMinutes: null,
        sortOrder: 2,
      },
      SERVICE_ACTOR.id,
    );
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Cắt tóc nam cao cấp',
          normalizedName: 'cat toc nam cao cap',
          slug: 'cat-toc-nam-cao-cap',
          description: 'Mô tả',
          iconUrl: 'content_cut',
          defaultDurationMinutes: null,
          sortOrder: 2,
        }) as object,
      }),
    );
  });

  it('only activates a service under an active category', async () => {
    const { commandService, service } = createServicesTestContext();
    service.findUnique.mockResolvedValue({
      ...BASE_SERVICE,
      category: { status: ServiceCategoryStatus.INACTIVE },
    });
    await expect(
      commandService.updateStatus(
        BASE_SERVICE.id,
        { status: ServiceStatus.ACTIVE },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    service.findUnique.mockResolvedValue({
      ...BASE_SERVICE,
      category: { status: ServiceCategoryStatus.ACTIVE },
    });
    service.update.mockResolvedValue({
      ...ADMIN_SERVICE,
      status: ServiceStatus.ACTIVE,
    });
    await expect(
      commandService.updateStatus(
        BASE_SERVICE.id,
        { status: ServiceStatus.ACTIVE },
        SERVICE_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it('rejects a status update for a missing service', async () => {
    const { commandService, service } = createServicesTestContext();
    service.findUnique.mockResolvedValue(null);
    await expect(
      commandService.updateStatus(
        BASE_SERVICE.id,
        { status: ServiceStatus.ACTIVE },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps reordering scoped to the selected category', async () => {
    const { commandService, service } = createServicesTestContext();
    service.findMany.mockResolvedValueOnce([]);
    await expect(
      commandService.reorder(
        SERVICE_CATEGORY.id,
        { items: [{ id: BASE_SERVICE.id, sortOrder: 1 }] },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate reorder ids and a missing category', async () => {
    const { commandService, serviceCategory } = createServicesTestContext();
    const item = { id: BASE_SERVICE.id, sortOrder: 1 };
    await expect(
      commandService.reorder(
        SERVICE_CATEGORY.id,
        { items: [item, item] },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    serviceCategory.findUnique.mockResolvedValue(null);
    await expect(
      commandService.reorder(
        SERVICE_CATEGORY.id,
        { items: [item] },
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders services and records an audit event', async () => {
    const { commandService, service, auditLog } = createServicesTestContext();
    service.findMany
      .mockResolvedValueOnce([{ id: BASE_SERVICE.id }])
      .mockResolvedValueOnce([ADMIN_SERVICE]);
    await expect(
      commandService.reorder(
        SERVICE_CATEGORY.id,
        { items: [{ id: BASE_SERVICE.id, sortOrder: 1 }] },
        SERVICE_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true, data: [ADMIN_SERVICE] });
    expect(service.update).toHaveBeenCalled();
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'SERVICES_REORDERED' }) as object,
    });
  });
});
