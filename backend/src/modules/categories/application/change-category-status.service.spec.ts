import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceCategoryStatus } from '@prisma/client';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  CATEGORY_ACTOR,
  createCategoriesTestContext,
} from '../testing/categories-test.factory';

describe('ChangeCategoryStatusService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changes category status using an allowed transition', async () => {
    const { commandService, serviceCategory, auditLog } =
      createCategoriesTestContext();
    const active = {
      ...ADMIN_CATEGORY,
      status: ServiceCategoryStatus.ACTIVE,
    };
    serviceCategory.update.mockResolvedValue(active);

    await expect(
      commandService.updateStatus(
        BASE_CATEGORY.id,
        { status: ServiceCategoryStatus.ACTIVE },
        CATEGORY_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true, data: active });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SERVICE_CATEGORY_STATUS_CHANGED',
        metadata: {
          from: ServiceCategoryStatus.INACTIVE,
          to: ServiceCategoryStatus.ACTIVE,
        },
      }) as object,
    });
  });

  it('rejects status changes for a missing category', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      commandService.updateStatus(
        BASE_CATEGORY.id,
        { status: ServiceCategoryStatus.ACTIVE },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects setting the current status again', async () => {
    const { commandService } = createCategoriesTestContext();

    await expect(
      commandService.updateStatus(
        BASE_CATEGORY.id,
        { status: ServiceCategoryStatus.INACTIVE },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a direct archived to active transition', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue({
      ...BASE_CATEGORY,
      status: ServiceCategoryStatus.ARCHIVED,
    });

    await expect(
      commandService.updateStatus(
        BASE_CATEGORY.id,
        { status: ServiceCategoryStatus.ACTIVE },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
