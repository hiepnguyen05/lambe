import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  type UploadApiErrorResponse,
  type UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';
import type {
  MediaDeliveryType,
  MediaStorage,
  UploadResult,
} from '../../modules/upload/application/media-storage.port';
import type { FeedMediaStorage } from '../../modules/social-feed/application/feed-media-storage.port';

interface CloudinaryDestroyResponse {
  result?: string;
}

const MAX_PUBLISHED_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class CloudinaryService implements MediaStorage, FeedMediaStorage {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly enabled: boolean;
  private readonly uploadPreset: string;
  private readonly kycUploadPreset: string;
  private readonly chatUploadPreset: string;
  private readonly privateUrlTtlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('cloudinary.enabled', false);
    this.uploadPreset = this.configService.get<string>(
      'cloudinary.uploadPreset',
      '',
    );
    this.kycUploadPreset = this.configService.get<string>(
      'cloudinary.kycUploadPreset',
      this.uploadPreset,
    );
    this.chatUploadPreset = this.configService.get<string>(
      'cloudinary.chatUploadPreset',
      '',
    );
    this.privateUrlTtlSeconds = this.configService.get<number>(
      'cloudinary.privateUrlTtlSeconds',
      300,
    );

    if (this.enabled) {
      cloudinary.config({
        cloud_name: this.configService.getOrThrow<string>(
          'cloudinary.cloudName',
        ),
        api_key: this.configService.getOrThrow<string>('cloudinary.apiKey'),
        api_secret: this.configService.getOrThrow<string>(
          'cloudinary.apiSecret',
        ),
        secure: true,
      });
    }
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<UploadResult> {
    return this.upload(buffer, folder, this.uploadPreset, 'upload');
  }

  async uploadPrivateImage(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, folder, this.kycUploadPreset, 'authenticated');
  }

  async uploadChatImage(buffer: Buffer, folder: string): Promise<UploadResult> {
    return this.upload(
      buffer,
      folder,
      this.chatUploadPreset,
      'authenticated',
      'strip_profile',
    );
  }

  async uploadFeedImage(buffer: Buffer, folder: string): Promise<UploadResult> {
    return this.upload(
      buffer,
      folder,
      this.uploadPreset,
      'authenticated',
      'force_strip',
    );
  }

  async uploadFeedVideo(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadResult & { durationSeconds?: number }> {
    this.assertEnabled();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'video',
          type: 'authenticated',
          allowed_formats: ['mp4'],
          transformation: [{ flags: 'force_strip' }],
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('cloudinary.video.upload_failed');
            reject(
              new ServiceUnavailableException(
                'Video storage is temporarily unavailable',
              ),
            );
            return;
          }
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            durationSeconds:
              typeof result.duration === 'number' ? result.duration : undefined,
            resourceType: result.resource_type,
            deliveryType: 'authenticated',
          });
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  async publishPrivateImage(
    publicId: string,
    format: string,
    folder: string,
  ): Promise<UploadResult> {
    const privateUrl = this.createPrivateDownloadUrl(publicId, format);
    try {
      const response = await fetch(privateUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok)
        throw new Error(`download failed with ${response.status}`);
      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_PUBLISHED_IMAGE_BYTES) {
        throw new Error('private image exceeds publication limit');
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_PUBLISHED_IMAGE_BYTES) {
        throw new Error('private image has invalid size');
      }
      return await this.uploadImage(buffer, folder);
    } catch {
      this.logger.error('cloudinary.image.publication_failed');
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable',
      );
    }
  }

  createPrivateDownloadUrl(publicId: string, format: string): string {
    this.assertEnabled();

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + this.privateUrlTtlSeconds,
      attachment: false,
    });
  }

  createFeedDownloadUrl(
    publicId: string,
    format: string,
    kind: string,
  ): string {
    this.assertEnabled();
    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: kind === 'VIDEO' ? 'video' : 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 300,
      attachment: false,
    });
  }

  private async upload(
    buffer: Buffer,
    folder: string,
    preset: string,
    deliveryType: MediaDeliveryType,
    stripMetadata: false | 'strip_profile' | 'force_strip' = false,
  ): Promise<UploadResult> {
    this.assertEnabled();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          ...(preset && { upload_preset: preset }),
          resource_type: 'image',
          type: deliveryType,
          allowed_formats:
            deliveryType === 'authenticated'
              ? ['jpg', 'jpeg', 'png', 'gif', 'webp']
              : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
          ...(stripMetadata && {
            transformation: [{ flags: stripMetadata }],
          }),
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('cloudinary.image.upload_failed');
            reject(
              new ServiceUnavailableException(
                'Image storage is temporarily unavailable',
              ),
            );
            return;
          }

          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            resourceType: result.resource_type,
            deliveryType,
          });
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteImage(
    publicId: string,
    deliveryType: MediaDeliveryType = 'upload',
  ): Promise<boolean> {
    this.assertEnabled();

    try {
      const response = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        type: deliveryType,
        invalidate: true,
      })) as CloudinaryDestroyResponse;
      return response.result === 'ok';
    } catch {
      this.logger.error('cloudinary.image.delete_failed');
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable',
      );
    }
  }

  async deleteFeedVideo(
    publicId: string,
    deliveryType: MediaDeliveryType = 'upload',
  ): Promise<boolean> {
    this.assertEnabled();
    try {
      const response = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video',
        type: deliveryType,
        invalidate: true,
      })) as CloudinaryDestroyResponse;
      return response.result === 'ok';
    } catch {
      this.logger.error('cloudinary.video.delete_failed');
      throw new ServiceUnavailableException(
        'Video storage is temporarily unavailable',
      );
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Image storage is not configured');
    }
  }
}
