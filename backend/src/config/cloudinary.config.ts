import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => ({
  enabled: process.env.CLOUDINARY_ENABLED === 'true',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
  kycUploadPreset:
    process.env.CLOUDINARY_KYC_UPLOAD_PRESET ||
    process.env.CLOUDINARY_UPLOAD_PRESET ||
    '',
  privateUrlTtlSeconds: Number(
    process.env.CLOUDINARY_PRIVATE_URL_TTL_SECONDS || 300,
  ),
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
}));
