const REQUIRED_SECRET_LENGTH = 32;

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function requireValue(config: Record<string, unknown>, key: string): string {
  const value = toStringValue(config[key]).trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function requireSecret(config: Record<string, unknown>, key: string): void {
  const value = requireValue(config, key);

  if (value.length < REQUIRED_SECRET_LENGTH || value.startsWith('CHANGE_ME')) {
    throw new Error(
      `${key} must contain at least 32 non-placeholder characters`,
    );
  }
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = toStringValue(config.NODE_ENV, 'development');
  const port = Number(config.PORT ?? 5000);
  const redisEnabled = toStringValue(config.REDIS_ENABLED, 'false');
  const cloudinaryEnabled = toStringValue(config.CLOUDINARY_ENABLED, 'false');
  const trustProxy = toStringValue(config.TRUST_PROXY, 'false').trim();

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  if (!['true', 'false'].includes(redisEnabled)) {
    throw new Error('REDIS_ENABLED must be true or false');
  }

  if (!['true', 'false'].includes(cloudinaryEnabled)) {
    throw new Error('CLOUDINARY_ENABLED must be true or false');
  }

  if (
    !['false', 'loopback', 'linklocal', 'uniquelocal'].includes(trustProxy) &&
    !/^\d+$/.test(trustProxy)
  ) {
    throw new Error(
      'TRUST_PROXY must be false, a trusted subnet name, or a hop count',
    );
  }

  if (cloudinaryEnabled === 'true') {
    requireValue(config, 'CLOUDINARY_CLOUD_NAME');
    requireValue(config, 'CLOUDINARY_UPLOAD_PRESET');
    requireValue(config, 'CLOUDINARY_API_KEY');
    requireValue(config, 'CLOUDINARY_API_SECRET');
  }

  if (redisEnabled === 'true') {
    const redisUrl = requireValue(config, 'REDIS_URL');
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      throw new Error('REDIS_URL must use redis:// or rediss://');
    }
  }

  requireValue(config, 'DATABASE_URL');
  requireSecret(config, 'JWT_SECRET');
  requireSecret(config, 'OTP_HASH_SECRET');
  requireSecret(config, 'INTERNAL_JWT_SECRET');

  if (config.INTERNAL_JWT_SECRET === config.JWT_SECRET) {
    throw new Error('INTERNAL_JWT_SECRET must be different from JWT_SECRET');
  }

  if (nodeEnv === 'production') {
    requireValue(config, 'CORS_ORIGIN');
    const speedSmsAccessToken = requireValue(config, 'SPEEDSMS_ACCESS_TOKEN');

    if (
      speedSmsAccessToken.startsWith('YOUR_') ||
      speedSmsAccessToken.startsWith('CHANGE_ME')
    ) {
      throw new Error(
        'Production SpeedSMS access token cannot use a placeholder',
      );
    }
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    REDIS_ENABLED: redisEnabled,
    CLOUDINARY_ENABLED: cloudinaryEnabled,
    TRUST_PROXY: trustProxy,
  };
}
