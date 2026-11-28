import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  enabled: process.env.REDIS_ENABLED === 'true',
  feedSafetyEnabled: process.env.FEED_SAFETY_ENABLED !== 'false',
  feedEnabled: process.env.FEED_CACHE_ENABLED === 'true',
  feedPostTtlSeconds: Number(process.env.FEED_CACHE_POST_TTL_SECONDS ?? 120),
  feedTimeoutMs: Number(process.env.FEED_CACHE_TIMEOUT_MS ?? 100),
  feedRecommendationsEnabled:
    process.env.FEED_RECOMMENDATIONS_ENABLED === 'true',
  feedBatchSize: Number(process.env.FEED_CACHE_BATCH_SIZE ?? 50),
  feedWorkerIntervalMs: Number(
    process.env.FEED_CACHE_WORKER_INTERVAL_MS ?? 5000,
  ),
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultTtlSeconds: Number(process.env.REDIS_DEFAULT_TTL_SECONDS ?? 300),
  connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000),
  commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1000),
  providerLocationTtlSeconds: Number(
    process.env.PROVIDER_LOCATION_TTL_SECONDS ?? 120,
  ),
}));
