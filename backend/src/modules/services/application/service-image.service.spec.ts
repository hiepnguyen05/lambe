import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ADMIN_SERVICE,
  BASE_SERVICE,
  SERVICE_ACTOR,
  createServicesTestContext,
} from '../testing/services-test.factory';

describe('ServiceImageService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads a managed cover image and persists its public id', async () => {
    const { imageService, service, mediaStorage, auditLog } =
      createServicesTestContext();
    service.findUniqueOrThrow.mockResolvedValue({
      ...ADMIN_SERVICE,
      coverImageUrl: 'https://example.test/service.webp',
    });

    await expect(
      imageService.uploadCover(
        BASE_SERVICE.id,
        Buffer.from('image'),
        SERVICE_ACTOR.id,
      ),
    ).resolves.toMatchObject({ success: true });
    expect(mediaStorage.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      `lambe/services/${BASE_SERVICE.id}`,
    );
    expect(service.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          coverImageUrl: 'https://example.test/service.webp',
          coverImagePublicId: 'lambe/services/service-id/cover',
        }) as object,
      }),
    );
    expect(auditLog.create).toHaveBeenCalled();
  });

  it('deletes the uploaded image after an optimistic write conflict', async () => {
    const { imageService, service, mediaStorage } = createServicesTestContext();
    service.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      imageService.uploadCover(
        BASE_SERVICE.id,
        Buffer.from('image'),
        SERVICE_ACTOR.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      'lambe/services/service-id/cover',
    );
  });

  it('rejects removing a cover when none exists', async () => {
    const { imageService } = createServicesTestContext();
    await expect(
      imageService.removeCover(BASE_SERVICE.id, SERVICE_ACTOR.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
