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

function requireBase64Key(
  config: Record<string, unknown>,
  key: string,
  byteLength: number,
): void {
  const value = requireValue(config, key);
  const decoded = Buffer.from(value, 'base64');
  if (
    decoded.length !== byteLength ||
    decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')
  ) {
    throw new Error(
      `${key} must be a valid base64-encoded ${byteLength}-byte key`,
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
  const mailEnabled = toStringValue(config.MAIL_ENABLED, 'false');
  const firebaseEnabled = toStringValue(config.FIREBASE_ENABLED, 'false');
  const smtpSecure = toStringValue(config.SMTP_SECURE, 'true');
  const smtpPort = Number(config.SMTP_PORT ?? 465);
  const smtpConnectionTimeoutMs = Number(
    config.SMTP_CONNECTION_TIMEOUT_MS ?? 10000,
  );
  const privateUrlTtlSeconds = Number(
    config.CLOUDINARY_PRIVATE_URL_TTL_SECONDS ?? 300,
  );
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

  if (!['true', 'false'].includes(mailEnabled)) {
    throw new Error('MAIL_ENABLED must be true or false');
  }

  if (!['true', 'false'].includes(firebaseEnabled)) {
    throw new Error('FIREBASE_ENABLED must be true or false');
  }

  if (!['true', 'false'].includes(smtpSecure)) {
    throw new Error('SMTP_SECURE must be true or false');
  }

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }

  if (
    !Number.isInteger(smtpConnectionTimeoutMs) ||
    smtpConnectionTimeoutMs < 1000 ||
    smtpConnectionTimeoutMs > 60000
  ) {
    throw new Error(
      'SMTP_CONNECTION_TIMEOUT_MS must be between 1000 and 60000',
    );
  }

  if (
    !Number.isInteger(privateUrlTtlSeconds) ||
    privateUrlTtlSeconds < 60 ||
    privateUrlTtlSeconds > 900
  ) {
    throw new Error(
      'CLOUDINARY_PRIVATE_URL_TTL_SECONDS must be between 60 and 900',
    );
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

  if (mailEnabled === 'true') {
    requireValue(config, 'SMTP_HOST');
    const smtpUser = requireValue(config, 'SMTP_USER');
    const appPassword = requireValue(config, 'SMTP_APP_PASSWORD').replace(
      /\s+/g,
      '',
    );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser)) {
      throw new Error('SMTP_USER must be a valid email address');
    }
    if (appPassword.length < 16) {
      throw new Error('SMTP_APP_PASSWORD must contain at least 16 characters');
    }
  }

  if (firebaseEnabled === 'true') {
    requireValue(config, 'FIREBASE_PROJECT_ID');
    const emulatorHost = toStringValue(
      config.FIREBASE_AUTH_EMULATOR_HOST,
    ).trim();

    if (!emulatorHost) {
      requireValue(config, 'GOOGLE_APPLICATION_CREDENTIALS');
    }
  }

  requireValue(config, 'DATABASE_URL');
  requireSecret(config, 'JWT_SECRET');
  requireSecret(config, 'INTERNAL_JWT_SECRET');

  if (config.INTERNAL_JWT_SECRET === config.JWT_SECRET) {
    throw new Error('INTERNAL_JWT_SECRET must be different from JWT_SECRET');
  }

  if (nodeEnv === 'production') {
    requireBase64Key(config, 'KYC_ENCRYPTION_KEY', 32);
    requireValue(config, 'CORS_ORIGIN');
    if (firebaseEnabled !== 'true') {
      throw new Error('FIREBASE_ENABLED must be true in production');
    }
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    REDIS_ENABLED: redisEnabled,
    CLOUDINARY_ENABLED: cloudinaryEnabled,
    MAIL_ENABLED: mailEnabled,
    FIREBASE_ENABLED: firebaseEnabled,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: smtpSecure,
    SMTP_CONNECTION_TIMEOUT_MS: smtpConnectionTimeoutMs,
    CLOUDINARY_PRIVATE_URL_TTL_SECONDS: privateUrlTtlSeconds,
    TRUST_PROXY: trustProxy,
  };
}
