import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const kycEncryptionKey = Buffer.alloc(32, 7).toString('base64');
  const validEnvironment = {
    NODE_ENV: 'development',
    PORT: '5000',
    DATABASE_URL: 'postgresql://localhost:5432/lambe_test',
    JWT_SECRET: 'user-jwt-secret-that-is-at-least-32-characters',
    INTERNAL_JWT_SECRET: 'internal-jwt-secret-that-is-at-least-32-characters',
  };

  it('accepts independent user and internal JWT secrets', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      REDIS_ENABLED: 'false',
      CLOUDINARY_ENABLED: 'false',
      MAIL_ENABLED: 'false',
      FIREBASE_ENABLED: 'false',
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

  it('requires valid SMTP credentials only when email is enabled', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, MAIL_ENABLED: 'true' }),
    ).toThrow('Missing required environment variable: SMTP_HOST');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'invalid-email',
        SMTP_APP_PASSWORD: '1234567890123456',
      }),
    ).toThrow('SMTP_USER must be a valid email address');

    expect(
      validateEnvironment({
        ...validEnvironment,
        MAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'sender@example.com',
        SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop',
      }),
    ).toMatchObject({
      MAIL_ENABLED: 'true',
      SMTP_PORT: 465,
      SMTP_SECURE: 'true',
    });
  });

  it('requires Firebase project credentials when phone auth is enabled', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, FIREBASE_ENABLED: 'true' }),
    ).toThrow('Missing required environment variable: FIREBASE_PROJECT_ID');

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        FIREBASE_ENABLED: 'true',
        FIREBASE_PROJECT_ID: 'lambe-test',
      }),
    ).toThrow(
      'Missing required environment variable: GOOGLE_APPLICATION_CREDENTIALS',
    );

    expect(
      validateEnvironment({
        ...validEnvironment,
        FIREBASE_ENABLED: 'true',
        FIREBASE_PROJECT_ID: 'lambe-test',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      }),
    ).toMatchObject({ FIREBASE_ENABLED: 'true' });
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

  it.each(['DATABASE_URL', 'JWT_SECRET'] as const)(
    'rejects a missing required value: %s',
    (key) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, [key]: '' }),
      ).toThrow();
    },
  );

  it.each(['JWT_SECRET', 'INTERNAL_JWT_SECRET'] as const)(
    'rejects a short or placeholder secret: %s',
    (key) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment, [key]: 'CHANGE_ME' }),
      ).toThrow(`${key} must contain at least 32 non-placeholder characters`);
    },
  );

  it('requires production-only CORS and Firebase configuration', () => {
    const productionEnvironment = {
      ...validEnvironment,
      NODE_ENV: 'production',
      KYC_ENCRYPTION_KEY: kycEncryptionKey,
    };

    expect(() => validateEnvironment(productionEnvironment)).toThrow(
      'Missing required environment variable: CORS_ORIGIN',
    );
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        CORS_ORIGIN: 'https://admin.lambe.vn',
      }),
    ).toThrow('FIREBASE_ENABLED must be true in production');
  });

  it('accepts a complete production environment', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://admin.lambe.vn',
        FIREBASE_ENABLED: 'true',
        FIREBASE_PROJECT_ID: 'lambe-f7213',
        GOOGLE_APPLICATION_CREDENTIALS: '/run/secrets/firebase.json',
        KYC_ENCRYPTION_KEY: kycEncryptionKey,
      }),
    ).toMatchObject({ NODE_ENV: 'production', PORT: 5000 });
  });

  it.each([
    '*',
    'http://admin.lambe.vn',
    'https://admin.lambe.vn/path',
    'https://admin.lambe.vn, ',
  ])('rejects unsafe production CORS origins: %s', (CORS_ORIGIN) => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        KYC_ENCRYPTION_KEY: kycEncryptionKey,
        CORS_ORIGIN,
      }),
    ).toThrow('CORS_ORIGIN must contain only HTTPS origins');
  });

  it('rejects Firebase Auth Emulator in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        KYC_ENCRYPTION_KEY: kycEncryptionKey,
        CORS_ORIGIN: 'https://admin.lambe.vn',
        FIREBASE_ENABLED: 'true',
        FIREBASE_PROJECT_ID: 'lambe-f7213',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      }),
    ).toThrow('FIREBASE_AUTH_EMULATOR_HOST must be empty in production');
  });

  it.each([
    ['INTERNAL_REFRESH_TOKEN_EXPIRES_DAYS', '0'],
    ['INTERNAL_MAX_FAILED_ATTEMPTS', 'NaN'],
    ['INTERNAL_LOCK_DURATION_MINUTES', '1441'],
  ])('rejects invalid internal auth setting %s', (key, value) => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, [key]: value }),
    ).toThrow(`${key} must be an integer between 1 and`);
  });

  it('requires a 32-byte base64 KYC encryption key in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        KYC_ENCRYPTION_KEY: 'not-a-valid-key',
      }),
    ).toThrow('KYC_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key');
  });
});
