import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  CATEGORY_ACTOR,
  createCategoriesTestContext,
} from '../testing/categories-test.factory';

describe('ReorderCategoriesService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects duplicate category ids in a reorder request', async () => {
    const { commandService } = createCategoriesTestContext();
    const item = { id: BASE_CATEGORY.id, sortOrder: 1 };

    await expect(
      commandService.reorder({ items: [item, item] }, CATEGORY_ACTOR.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing categories in a reorder request', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findMany.mockResolvedValue([]);

    await expect(
      commandService.reorder(
        { items: [{ id: BASE_CATEGORY.id, sortOrder: 1 }] },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders categories and records one batch audit event', async () => {
    const { commandService, serviceCategory, auditLog } =
      createCategoriesTestContext();
    serviceCategory.findMany
      .mockResolvedValueOnce([{ id: BASE_CATEGORY.id }])
      .mockResolvedValueOnce([ADMIN_CATEGORY]);

    await expect(
      commandService.reorder(
        { items: [{ id: BASE_CATEGORY.id, sortOrder: 5 }] },
        CATEGORY_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true, data: [ADMIN_CATEGORY] });
    expect(serviceCategory.update).toHaveBeenCalledWith({
      where: { id: BASE_CATEGORY.id },
      data: { sortOrder: 5, updatedById: CATEGORY_ACTOR.id },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SERVICE_CATEGORIES_REORDERED',
        metadata: { items: [{ id: BASE_CATEGORY.id, sortOrder: 5 }] },
      }) as object,
    });
  });
});
