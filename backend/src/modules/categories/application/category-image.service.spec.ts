import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ADMIN_CATEGORY,
  BASE_CATEGORY,
  CATEGORY_ACTOR,
  createCategoriesTestContext,
} from '../testing/categories-test.factory';

describe('CategoryImageService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads a cover, stores its public id and removes the replaced image', async () => {
    const {
      categoryImageService,
      serviceCategory,
      mediaStorage,
      auditLog,
      cache,
    } = createCategoriesTestContext();
    const existing = {
      ...BASE_CATEGORY,
      coverImageUrl: 'https://example.test/old.webp',
      coverImagePublicId: 'lambe/categories/old',
    };
    const updated = {
      ...ADMIN_CATEGORY,
      coverImageUrl: 'https://example.test/category.webp',
    };
    serviceCategory.findUnique.mockResolvedValue(existing);
    serviceCategory.findUniqueOrThrow.mockResolvedValue(updated);

    await expect(
      categoryImageService.uploadCover(
        BASE_CATEGORY.id,
        Buffer.from('image'),
        CATEGORY_ACTOR.id,
        { requestId: 'request-id' },
      ),
    ).resolves.toMatchObject({ success: true, data: updated });

    expect(mediaStorage.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      `lambe/categories/${BASE_CATEGORY.id}`,
    );
    expect(serviceCategory.updateMany).toHaveBeenCalledWith({
      where: { id: BASE_CATEGORY.id, updatedAt: existing.updatedAt },
      data: {
        coverImageUrl: 'https://example.test/category.webp',
        coverImagePublicId: 'lambe/categories/category-id/image',
        updatedById: CATEGORY_ACTOR.id,
      },
    });
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      'lambe/categories/old',
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SERVICE_CATEGORY_COVER_UPDATED',
        requestId: 'request-id',
      }) as object,
    });
    expect(cache.delete).toHaveBeenCalled();
  });

  it('deletes a newly uploaded image when a concurrent update wins', async () => {
    const { categoryImageService, serviceCategory, mediaStorage } =
      createCategoriesTestContext();
    serviceCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      categoryImageService.uploadCover(
        BASE_CATEGORY.id,
        Buffer.from('image'),
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      'lambe/categories/category-id/image',
    );
  });

  it('removes a managed cover and its cloud asset', async () => {
    const { categoryImageService, serviceCategory, mediaStorage } =
      createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue({
      ...BASE_CATEGORY,
      coverImageUrl: 'https://example.test/old.webp',
      coverImagePublicId: 'lambe/categories/old',
    });

    await expect(
      categoryImageService.removeCover(BASE_CATEGORY.id, CATEGORY_ACTOR.id),
    ).resolves.toMatchObject({ success: true });
    expect(serviceCategory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverImageUrl: null,
          coverImagePublicId: null,
        }) as object,
      }),
    );
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      'lambe/categories/old',
    );
  });

  it('rejects removal when the category has no cover', async () => {
    const { categoryImageService } = createCategoriesTestContext();

    await expect(
      categoryImageService.removeCover(BASE_CATEGORY.id, CATEGORY_ACTOR.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects upload for a missing category before contacting storage', async () => {
    const { categoryImageService, serviceCategory, mediaStorage } =
      createCategoriesTestContext();
    serviceCategory.findUnique.mockResolvedValue(null);

    await expect(
      categoryImageService.uploadCover(
        BASE_CATEGORY.id,
        Buffer.from('image'),
        CATEGORY_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mediaStorage.uploadImage).not.toHaveBeenCalled();
  });
});
