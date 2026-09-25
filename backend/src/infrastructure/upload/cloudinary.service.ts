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
  MediaStorage,
  UploadResult,
} from '../../modules/upload/application/media-storage.port';

interface CloudinaryDestroyResponse {
  result?: string;
}

@Injectable()
export class CloudinaryService implements MediaStorage {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly enabled: boolean;
  private readonly uploadPreset: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('cloudinary.enabled', false);
    this.uploadPreset = this.configService.get<string>(
      'cloudinary.uploadPreset',
      '',
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
    this.assertEnabled();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          upload_preset: this.uploadPreset,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary upload failed: ${error?.message || 'empty response'}`,
            );
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
          });
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<boolean> {
    this.assertEnabled();

    try {
      const response = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      })) as CloudinaryDestroyResponse;
      return response.result === 'ok';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Cloudinary delete failed for ${publicId}: ${message}`);
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable',
      );
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Image storage is not configured');
    }
  }
}
