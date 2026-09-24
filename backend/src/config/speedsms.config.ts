import { registerAs } from '@nestjs/config';

export default registerAs('speedsms', () => ({
  accessToken: process.env.SPEEDSMS_ACCESS_TOKEN || '',
  apiUrl: process.env.SPEEDSMS_API_URL || 'https://api.speedsms.vn/index.php',
  smsType: Number(process.env.SPEEDSMS_SMS_TYPE || 4),
  sender: process.env.SPEEDSMS_SENDER ?? '',
  timeoutMs: Number(process.env.SPEEDSMS_TIMEOUT_MS || 10000),
}));
