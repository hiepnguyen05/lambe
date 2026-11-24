import type { UploadResult } from '../../upload/application/media-storage.port';

export const FEED_MEDIA_STORAGE = Symbol('FEED_MEDIA_STORAGE');

export interface FeedMediaStorage {
  uploadFeedImage(buffer: Buffer, folder: string): Promise<UploadResult>;
  uploadFeedVideo(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadResult & { durationSeconds?: number }>;
  deleteImage(
    publicId: string,
    deliveryType?: 'upload' | 'authenticated',
  ): Promise<boolean>;
  deleteFeedVideo(
    publicId: string,
    deliveryType?: 'upload' | 'authenticated',
  ): Promise<boolean>;
  createFeedDownloadUrl?(
    publicId: string,
    format: string,
    kind: string,
  ): string;
}
