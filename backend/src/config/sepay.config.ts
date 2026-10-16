import { registerAs } from '@nestjs/config';

export default registerAs('sepay', () => ({
  enabled: process.env.SEPAY_ENABLED === 'true',
  environment: process.env.SEPAY_ENVIRONMENT || 'sandbox',
  merchantId: process.env.SEPAY_MERCHANT_ID || '',
  secretKey: process.env.SEPAY_SECRET_KEY || '',
  publicBaseUrl: process.env.SEPAY_PUBLIC_BASE_URL || '',
  ipnUrl: process.env.SEPAY_IPN_URL || '',
}));
