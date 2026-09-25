import { registerAs } from '@nestjs/config';

function parseTrustProxy(value: string | undefined): false | number | string {
  const normalized = value?.trim() || 'false';

  if (normalized === 'false') return false;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
}));
