import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
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
    utils: {
      private_download_url: jest.fn(),
    },
  },
}));

describe('CloudinaryService', () => {
  const uploadStream = cloudinary.uploader.upload_stream as jest.Mock;
  const destroy = cloudinary.uploader.destroy as jest.Mock;
  const privateDownloadUrl = cloudinary.utils.private_download_url as jest.Mock;

  const createService = (enabled: boolean) => {
    const values: Record<string, unknown> = {
      'cloudinary.enabled': enabled,
      'cloudinary.cloudName': 'lambe-cloud',
      'cloudinary.uploadPreset': 'lambe',
      'cloudinary.kycUploadPreset': 'lambe-kyc',
      'cloudinary.chatUploadPreset': 'lambe-chat',
      'cloudinary.privateUrlTtlSeconds': 300,
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

  let logError: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

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
      deliveryType: 'upload',
    });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'lambe/general',
        resource_type: 'image',
        type: 'upload',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      }),
      expect.any(Function),
    );
  });

  it('uploads KYC images as authenticated assets', async () => {
    uploadStream.mockImplementation(
      (
        _options: unknown,
        callback: (error: undefined, result: Record<string, unknown>) => void,
      ) => {
        callback(undefined, {
          url: 'http://example.test/private.webp',
          secure_url: 'https://example.test/private.webp',
          public_id: 'lambe/provider-applications/document',
          format: 'webp',
          resource_type: 'image',
        });
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    const service = createService(true);

    await expect(
      service.uploadPrivateImage(Buffer.from('image'), 'lambe/kyc'),
    ).resolves.toMatchObject({ deliveryType: 'authenticated' });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_preset: 'lambe-kyc',
        type: 'authenticated',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      }),
      expect.any(Function),
    );
  });

  it('uses the chat preset and strips embedded metadata from chat images', async () => {
    uploadStream.mockImplementation(
      (
        _options: unknown,
        callback: (error: undefined, result: Record<string, unknown>) => void,
      ) => {
        callback(undefined, {
          url: 'http://example.test/chat.webp',
          secure_url: 'https://example.test/chat.webp',
          public_id: 'lambe/chat/conversation/image',
          format: 'webp',
          width: 800,
          height: 600,
          resource_type: 'image',
        });
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    const service = createService(true);

    await expect(
      service.uploadChatImage(Buffer.from('image'), 'lambe/chat/conversation'),
    ).resolves.toMatchObject({ deliveryType: 'authenticated' });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        upload_preset: 'lambe-chat',
        type: 'authenticated',
        transformation: [{ flags: 'strip_profile' }],
      }),
      expect.any(Function),
    );
  });

  it('strips metadata from public feed images and short videos on upload', async () => {
    uploadStream.mockImplementation(
      (
        options: { resource_type: string },
        callback: (error: undefined, result: Record<string, unknown>) => void,
      ) => {
        callback(undefined, {
          url: 'http://example.test/feed',
          secure_url: 'https://example.test/feed',
          public_id: 'lambe/feed/media',
          format: options.resource_type === 'video' ? 'mp4' : 'webp',
          resource_type: options.resource_type,
          duration: options.resource_type === 'video' ? 24 : undefined,
        });
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    const service = createService(true);

    await expect(
      service.uploadFeedImage(Buffer.from('image'), 'lambe/feed'),
    ).resolves.toMatchObject({ resourceType: 'image' });
    await expect(
      service.uploadFeedVideo(Buffer.from('video'), 'lambe/feed'),
    ).resolves.toMatchObject({ resourceType: 'video', durationSeconds: 24 });
    expect(uploadStream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        resource_type: 'image',
        transformation: [{ flags: 'force_strip' }],
      }),
      expect.any(Function),
    );
    expect(uploadStream).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resource_type: 'video',
        transformation: [{ flags: 'force_strip' }],
      }),
      expect.any(Function),
    );
  });

  it('creates a short-lived signed URL for an authenticated asset', () => {
    privateDownloadUrl.mockReturnValue('https://private.example.test/file');
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const service = createService(true);

    expect(service.createPrivateDownloadUrl('lambe/kyc/id', 'webp')).toBe(
      'https://private.example.test/file',
    );
    expect(privateDownloadUrl).toHaveBeenCalledWith(
      'lambe/kyc/id',
      'webp',
      expect.objectContaining({
        type: 'authenticated',
        expires_at: 1_700_000_300,
        attachment: false,
      }),
    );
  });

  it('publishes a verified private image as a separate public asset', async () => {
    privateDownloadUrl.mockReturnValue('https://private.example.test/file');
    const service = createService(true);
    const published = {
      url: 'http://example.test/avatar.webp',
      secureUrl: 'https://example.test/avatar.webp',
      publicId: 'lambe/users/user-id/avatar/image',
      format: 'webp',
      resourceType: 'image',
      deliveryType: 'upload' as const,
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(Buffer.from('portrait'), {
        status: 200,
        headers: { 'content-length': '8' },
      }),
    );
    const uploadImage = jest
      .spyOn(service, 'uploadImage')
      .mockResolvedValue(published);

    await expect(
      service.publishPrivateImage(
        'lambe/provider-applications/portrait',
        'webp',
        'lambe/users/user-id/avatar',
      ),
    ).resolves.toEqual(published);
    expect(uploadImage).toHaveBeenCalledWith(
      Buffer.from('portrait'),
      'lambe/users/user-id/avatar',
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

    await expect(
      service.deleteImage('public-id', 'authenticated'),
    ).resolves.toBe(true);
    expect(destroy).toHaveBeenCalledWith(
      'public-id',
      expect.objectContaining({ type: 'authenticated', invalidate: true }),
    );

    destroy.mockRejectedValueOnce(new Error('provider credential detail'));
    await expect(service.deleteImage('public-id')).rejects.toThrow(
      'Image storage is temporarily unavailable',
    );
  });

  it('logs only operation events for upload, publication and deletion failures', async () => {
    const privateId = 'private/user-email@example.test/asset';
    const signedUrl = 'https://example.test/private?signature=secret-sentinel';
    const providerError = Object.assign(
      new Error(`provider credential detail ${signedUrl}`),
      {
        publicId: privateId,
        stack: 'private-stack-sentinel',
      },
    );
    uploadStream.mockImplementation(
      (_options: unknown, callback: (error: Error) => void) => {
        callback(providerError);
        return new Writable({ write: (_chunk, _encoding, done) => done() });
      },
    );
    destroy.mockRejectedValue(providerError);
    privateDownloadUrl.mockReturnValue(signedUrl);
    jest.spyOn(global, 'fetch').mockRejectedValue(providerError);
    const service = createService(true);
    const failures = [
      {
        run: () => service.uploadImage(Buffer.from('image'), privateId),
        event: 'cloudinary.image.upload_failed',
        message: 'Image storage is temporarily unavailable',
      },
      {
        run: () => service.uploadFeedVideo(Buffer.from('video'), privateId),
        event: 'cloudinary.video.upload_failed',
        message: 'Video storage is temporarily unavailable',
      },
      {
        run: () => service.publishPrivateImage(privateId, 'png', privateId),
        event: 'cloudinary.image.publication_failed',
        message: 'Image storage is temporarily unavailable',
      },
      {
        run: () => service.deleteImage(privateId),
        event: 'cloudinary.image.delete_failed',
        message: 'Image storage is temporarily unavailable',
      },
      {
        run: () => service.deleteFeedVideo(privateId),
        event: 'cloudinary.video.delete_failed',
        message: 'Video storage is temporarily unavailable',
      },
    ];
    for (const failure of failures) {
      await expect(failure.run()).rejects.toThrow(failure.message);
    }
    // Assert every argument, including any optional logger stack/context argument.
    expect(logError.mock.calls).toEqual(failures.map(({ event }) => [event]));
  });
});
