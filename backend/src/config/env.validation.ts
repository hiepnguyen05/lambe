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

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  requireValue(config, 'DATABASE_URL');
  requireSecret(config, 'JWT_SECRET');
  requireSecret(config, 'OTP_HASH_SECRET');

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
  };
}
