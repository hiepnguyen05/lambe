import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  CATEGORY_ACTOR,
  createCategoriesTestContext,
} from '../testing/categories-test.factory';

describe('UpdateCategoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an empty update', async () => {
    const { commandService } = createCategoriesTestContext();

    await expect(
      commandService.update(BASE_CATEGORY.id, {}, CATEGORY_ACTOR.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an update for a missing category', async () => {
    const { commandService, serviceCategory } = createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      commandService.update(
        BASE_CATEGORY.id,
        { name: 'Nail' },
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates editable fields and audits before and after values', async () => {
    const { commandService, serviceCategory, auditLog } =
      createCategoriesTestContext();
    const updated = {
      ...ADMIN_CATEGORY,
      name: 'Ch\u0103m s\u00f3c t\u00f3c',
      slug: 'cham-soc-toc',
      description: 'M\u1edbi',
      iconUrl: 'https://example.com/icon.png',
      sortOrder: 3,
    };
    serviceCategory.update.mockResolvedValue(updated);

    await expect(
      commandService.update(
        BASE_CATEGORY.id,
        {
          name: ' Ch\u0103m s\u00f3c t\u00f3c ',
          slug: ' CHAM-SOC-TOC ',
          description: ' M\u1edbi ',
          iconUrl: ' https://example.com/icon.png ',
          sortOrder: 3,
        },
        CATEGORY_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true, data: updated });

    expect(serviceCategory.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ normalizedName: 'cham soc toc' }, { slug: 'cham-soc-toc' }],
        NOT: { id: BASE_CATEGORY.id },
      },
    });
    expect(serviceCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Ch\u0103m s\u00f3c t\u00f3c',
          normalizedName: 'cham soc toc',
          updatedById: CATEGORY_ACTOR.id,
        }) as object,
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SERVICE_CATEGORY_UPDATED',
        metadata: expect.objectContaining({
          before: expect.any(Object) as object,
          after: expect.any(Object) as object,
        }) as object,
      }) as object,
    });
  });
});
