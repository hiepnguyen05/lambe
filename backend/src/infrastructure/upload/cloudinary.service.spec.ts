import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Writable } from 'stream';
import { CloudinaryService } from './cloudinary.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('CloudinaryService', () => {
  const uploadStream = cloudinary.uploader.upload_stream as jest.Mock;
  const destroy = cloudinary.uploader.destroy as jest.Mock;

  const createService = (enabled: boolean) => {
    const values: Record<string, unknown> = {
      'cloudinary.enabled': enabled,
      'cloudinary.cloudName': 'lambe-cloud',
      'cloudinary.uploadPreset': 'lambe',
      'cloudinary.apiKey': 'api-key',
      'cloudinary.apiSecret': 'api-secret',
    };
    const configService = {
      get: jest.fn(
        (key: string, fallback?: unknown) => values[key] ?? fallback,
      ),
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as jest.Mocked<ConfigService>;

    return new CloudinaryService(configService);
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects uploads when media storage is disabled', async () => {
    const service = createService(false);

    await expect(
      service.uploadImage(Buffer.from('image'), 'lambe/general'),
    ).rejects.toThrow('Image storage is not configured');
  });

  it('uploads only supported image formats and maps the provider response', async () => {
    uploadStream.mockImplementation(
      (
        _options: unknown,
        callback: (error: undefined, result: Record<string, unknown>) => void,
      ) => {
        callback(undefined, {
          url: 'http://example.test/image.webp',
          secure_url: 'https://example.test/image.webp',
          public_id: 'lambe/general/image',
          format: 'webp',
          width: 400,
          height: 300,
          resource_type: 'image',
        });
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    const service = createService(true);

    await expect(
      service.uploadImage(Buffer.from('image'), 'lambe/general'),
    ).resolves.toEqual({
      url: 'http://example.test/image.webp',
      secureUrl: 'https://example.test/image.webp',
      publicId: 'lambe/general/image',
      format: 'webp',
      width: 400,
      height: 300,
      resourceType: 'image',
    });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'lambe/general',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      }),
      expect.any(Function),
    );
  });

  it('hides Cloudinary upload failures from API clients', async () => {
    uploadStream.mockImplementation(
      (_options: unknown, callback: (error: { message: string }) => void) => {
        callback({ message: 'provider credential detail' });
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    const service = createService(true);

    await expect(
      service.uploadImage(Buffer.from('image'), 'lambe/general'),
    ).rejects.toThrow('Image storage is temporarily unavailable');
  });

  it('deletes an image and maps provider errors to a stable exception', async () => {
    const service = createService(true);
    destroy.mockResolvedValueOnce({ result: 'ok' });

    await expect(service.deleteImage('public-id')).resolves.toBe(true);

    destroy.mockRejectedValueOnce(new Error('provider credential detail'));
    await expect(service.deleteImage('public-id')).rejects.toThrow(
      'Image storage is temporarily unavailable',
    );
  });
});
