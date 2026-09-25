import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    NODE_ENV: 'development',
    PORT: '5000',
    DATABASE_URL: 'postgresql://localhost:5432/lambe_test',
    JWT_SECRET: 'user-jwt-secret-that-is-at-least-32-characters',
    OTP_HASH_SECRET: 'otp-hash-secret-that-is-at-least-32-characters',
    INTERNAL_JWT_SECRET: 'internal-jwt-secret-that-is-at-least-32-characters',
  };

  it('accepts independent user and internal JWT secrets', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      REDIS_ENABLED: 'false',
      CLOUDINARY_ENABLED: 'false',
      TRUST_PROXY: 'false',
    });
  });

  it('requires complete Cloudinary credentials only when uploads are enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CLOUDINARY_ENABLED: 'true',
      }),
    ).toThrow('Missing required environment variable: CLOUDINARY_CLOUD_NAME');

    expect(
      validateEnvironment({
        ...validEnvironment,
        CLOUDINARY_ENABLED: 'true',
        CLOUDINARY_CLOUD_NAME: 'lambe-cloud',
        CLOUDINARY_UPLOAD_PRESET: 'lambe',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    ).toMatchObject({ CLOUDINARY_ENABLED: 'true' });
  });

  it.each(['true', '*', 'proxy.example.com'])(
    'rejects an unsafe TRUST_PROXY value: %s',
    (TRUST_PROXY) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, TRUST_PROXY }),
      ).toThrow(
        'TRUST_PROXY must be false, a trusted subnet name, or a hop count',
      );
    },
  );

  it('validates Redis settings only when cache is enabled', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, REDIS_ENABLED: 'yes' }),
    ).toThrow('REDIS_ENABLED must be true or false');
    expect(() =>
      validateEnvironment({ ...validEnvironment, REDIS_ENABLED: 'true' }),
    ).toThrow('Missing required environment variable: REDIS_URL');
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REDIS_ENABLED: 'true',
        REDIS_URL: 'http://localhost:6379',
      }),
    ).toThrow('REDIS_URL must use redis:// or rediss://');
    expect(
      validateEnvironment({
        ...validEnvironment,
        REDIS_ENABLED: 'true',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toMatchObject({ REDIS_ENABLED: 'true' });
  });

  it('requires the internal JWT secret outside production too', () => {
    const environmentWithoutInternalSecret = { ...validEnvironment };
    delete (
      environmentWithoutInternalSecret as Partial<typeof validEnvironment>
    ).INTERNAL_JWT_SECRET;

    expect(() => validateEnvironment(environmentWithoutInternalSecret)).toThrow(
      'Missing required environment variable: INTERNAL_JWT_SECRET',
    );
  });

  it('rejects sharing a secret between user and internal authentication', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        INTERNAL_JWT_SECRET: validEnvironment.JWT_SECRET,
      }),
    ).toThrow('INTERNAL_JWT_SECRET must be different from JWT_SECRET');
  });

  it.each(['staging', '', 'PRODUCTION'])(
    'rejects an unsupported NODE_ENV value: %s',
    (NODE_ENV) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, NODE_ENV }),
      ).toThrow('NODE_ENV must be development, test, or production');
    },
  );

  it.each(['0', '65536', '1.5', 'not-a-number'])(
    'rejects an invalid port: %s',
    (PORT) => {
      expect(() => validateEnvironment({ ...validEnvironment, PORT })).toThrow(
        'PORT must be a valid TCP port',
      );
    },
  );

  it.each(['DATABASE_URL', 'JWT_SECRET', 'OTP_HASH_SECRET'] as const)(
    'rejects a missing required value: %s',
    (key) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, [key]: '' }),
      ).toThrow();
    },
  );

  it.each(['JWT_SECRET', 'OTP_HASH_SECRET', 'INTERNAL_JWT_SECRET'] as const)(
    'rejects a short or placeholder secret: %s',
    (key) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, [key]: 'CHANGE_ME' }),
      ).toThrow(`${key} must contain at least 32 non-placeholder characters`);
    },
  );

  it('requires production-only CORS and SpeedSMS configuration', () => {
    const productionEnvironment = {
      ...validEnvironment,
      NODE_ENV: 'production',
    };

    expect(() => validateEnvironment(productionEnvironment)).toThrow(
      'Missing required environment variable: CORS_ORIGIN',
    );
    expect(() =>
      validateEnvironment({ ...productionEnvironment, CORS_ORIGIN: '*' }),
    ).toThrow('Missing required environment variable: SPEEDSMS_ACCESS_TOKEN');
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        CORS_ORIGIN: 'https://admin.lambe.vn',
        SPEEDSMS_ACCESS_TOKEN: 'YOUR_SPEEDSMS_ACCESS_TOKEN',
      }),
    ).toThrow('Production SpeedSMS access token cannot use a placeholder');
  });

  it('accepts a complete production environment', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://admin.lambe.vn',
        SPEEDSMS_ACCESS_TOKEN: 'real-token',
      }),
    ).toMatchObject({ NODE_ENV: 'production', PORT: 5000 });
  });
});
