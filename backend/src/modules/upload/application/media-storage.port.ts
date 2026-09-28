export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export type MediaDeliveryType = 'upload' | 'authenticated';

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  resourceType: string;
  deliveryType: MediaDeliveryType;
}

export interface MediaStorage {
  uploadImage(buffer: Buffer, folder: string): Promise<UploadResult>;
  uploadPrivateImage(buffer: Buffer, folder: string): Promise<UploadResult>;
  createPrivateDownloadUrl(publicId: string, format: string): string;
  deleteImage(
    publicId: string,
    deliveryType?: MediaDeliveryType,
  ): Promise<boolean>;
}
