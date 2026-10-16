import { registerAs } from '@nestjs/config';

export default registerAs('momo', () => ({
  enabled: process.env.MOMO_ENABLED === 'true',
  endpoint:
    process.env.MOMO_ENDPOINT ||
    'https://test-payment.momo.vn/v2/gateway/api/create',
  partnerCode: process.env.MOMO_PARTNER_CODE || '',
  accessKey: process.env.MOMO_ACCESS_KEY || '',
  secretKey: process.env.MOMO_SECRET_KEY || '',
  partnerName: process.env.MOMO_PARTNER_NAME || 'Lambe Test',
  storeId: process.env.MOMO_STORE_ID || 'LambeTestStore',
  ipnUrl: process.env.MOMO_IPN_URL || '',
  redirectUrl: process.env.MOMO_REDIRECT_URL || '',
}));
