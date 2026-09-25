import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => ({
  enabled: process.env.CLOUDINARY_ENABLED === 'true',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || '',
}));
