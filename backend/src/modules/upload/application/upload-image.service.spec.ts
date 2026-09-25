import { UploadImageService } from './upload-image.service';

describe('UploadImageService', () => {
  it('uploads to a Lambe-owned folder and writes an audit record', async () => {
    const storage = {
      uploadImage: jest.fn().mockResolvedValue({
        url: 'http://example.test/image.webp',
        secureUrl: 'https://example.test/image.webp',
        publicId: 'lambe/categories/image',
        format: 'webp',
        resourceType: 'image',
      }),
      deleteImage: jest.fn(),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new UploadImageService(storage, audit as never);
    const request = { requestId: 'request-id', ipAddress: '127.0.0.1' };

    await expect(
      service.execute(Buffer.from('image'), 'categories', 'admin-id', request),
    ).resolves.toMatchObject({ publicId: 'lambe/categories/image' });
    expect(storage.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'lambe/categories',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorInternalAccountId: 'admin-id',
        action: 'IMAGE_UPLOADED',
        resourceId: 'lambe/categories/image',
      }),
      request,
    );
  });
});
