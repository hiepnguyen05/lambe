export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  resourceType: string;
}

export interface MediaStorage {
  uploadImage(buffer: Buffer, folder: string): Promise<UploadResult>;
  deleteImage(publicId: string): Promise<boolean>;
}
