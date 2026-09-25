import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  enabled: process.env.REDIS_ENABLED === 'true',
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultTtlSeconds: Number(process.env.REDIS_DEFAULT_TTL_SECONDS ?? 300),
  connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 3000),
}));
