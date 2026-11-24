import { requireIsolatedTestDatabase } from '../../test/support/isolated-test-database';

describe('isolated test database guard', () => {
  const local = 'postgresql://test:test@127.0.0.1:5432/lambe_booking_test_ci';
  const pooledHost = 'ep-test-branch-pooler.c-5.ap-southeast-1.aws.neon.tech';
  const pooled = `postgresql://test:test@${pooledHost}/lambe_booking_test_cloud?sslmode=require`;
  const direct = pooled.replace('-pooler.', '.');
  const redis = 'rediss://default:test@lambe-test.upstash.io:6379';
  const cloud: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    TEST_TARGET: 'cloud',
    DATABASE_URL: pooled,
    TEST_DATABASE_URL: pooled,
    DIRECT_URL: direct,
    TEST_DIRECT_URL: direct,
    TEST_CLOUD_POSTGRES_HOST: pooledHost,
    REDIS_ENABLED: 'true',
    REDIS_URL: redis,
    TEST_REDIS_URL: redis,
    TEST_CLOUD_REDIS_HOST: 'lambe-test.upstash.io',
  };
  const development: NodeJS.ProcessEnv = {
    ...cloud,
    TEST_TARGET: 'development',
    TEST_ALLOW_EXISTING_DATA: 'lambe-dev-tests-authorized',
    DATABASE_URL: pooled.replace('lambe_booking_test_cloud', 'neondb'),
    TEST_DATABASE_URL: pooled.replace('lambe_booking_test_cloud', 'neondb'),
    DIRECT_URL: direct.replace('lambe_booking_test_cloud', 'neondb'),
    TEST_DIRECT_URL: direct.replace('lambe_booking_test_cloud', 'neondb'),
    FIREBASE_ENABLED: 'false',
    CLOUDINARY_ENABLED: 'false',
    MAIL_ENABLED: 'false',
    MOMO_ENABLED: 'false',
    SEPAY_ENABLED: 'false',
    GEMINI_ENABLED: 'false',
    GEMINI_WEB_SEARCH_ENABLED: 'false',
  };

  it('accepts an explicit local test database', () => {
    expect(() =>
      requireIsolatedTestDatabase({
        NODE_ENV: 'test',
        DATABASE_URL: local,
        TEST_DATABASE_URL: local,
      }),
    ).not.toThrow();
  });

  it.each([
    ['remote host', local.replace('127.0.0.1', 'db.example.com')],
    ['non-test name', local.replace('lambe_booking_test_ci', 'lambe_booking')],
    ['other schema', `${local}?schema=production`],
    ['fragment', `${local}#unsafe`],
  ])('rejects %s even with matching URLs', (_name, url) => {
    expect(() =>
      requireIsolatedTestDatabase({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        TEST_DATABASE_URL: url,
      }),
    ).toThrow('Tests require NODE_ENV=test');
  });

  it('rejects a mismatch with the application URL', () => {
    expect(() =>
      requireIsolatedTestDatabase({
        NODE_ENV: 'test',
        DATABASE_URL: local.replace('lambe_booking_test_ci', 'lambe_booking'),
        TEST_DATABASE_URL: local,
      }),
    ).toThrow('Tests require NODE_ENV=test');
  });

  it('rejects a migration URL targeting another database', () => {
    expect(() =>
      requireIsolatedTestDatabase({
        NODE_ENV: 'test',
        DATABASE_URL: local,
        TEST_DATABASE_URL: local,
        DIRECT_URL: local.replace('lambe_booking_test_ci', 'lambe_booking'),
      }),
    ).toThrow('Tests require NODE_ENV=test');
  });

  it('accepts only explicit matching cloud test endpoints', () => {
    expect(() => requireIsolatedTestDatabase(cloud)).not.toThrow();
  });

  it.each([
    { NODE_ENV: 'development' },
    { TEST_TARGET: undefined },
    { TEST_DATABASE_URL: pooled.replace('test_cloud', 'test_other') },
    { DATABASE_URL: pooled.replace('test_cloud', 'test_other') },
    {
      DATABASE_URL: pooled.replace('lambe_booking_test_cloud', 'neondb'),
      TEST_DATABASE_URL: pooled.replace('lambe_booking_test_cloud', 'neondb'),
    },
    {
      DATABASE_URL: pooled.replace('?sslmode=require', ''),
      TEST_DATABASE_URL: pooled.replace('?sslmode=require', ''),
    },
    {
      DATABASE_URL: pooled.replace('ep-test-branch', 'ep-main'),
      TEST_DATABASE_URL: pooled.replace('ep-test-branch', 'ep-main'),
    },
    { DIRECT_URL: pooled },
    { DIRECT_URL: undefined },
    { TEST_DIRECT_URL: direct.replace('test_cloud', 'test_other') },
    { REDIS_ENABLED: 'false' },
    {
      REDIS_URL: redis.replace('rediss:', 'redis:'),
      TEST_REDIS_URL: redis.replace('rediss:', 'redis:'),
    },
    {
      REDIS_URL: redis.replace('lambe-test', 'lambe-live'),
      TEST_REDIS_URL: redis.replace('lambe-test', 'lambe-live'),
    },
    { TEST_CLOUD_REDIS_HOST: 'lambe-live.upstash.io' },
    { REDIS_URL: `${redis}/15`, TEST_REDIS_URL: `${redis}/15` },
    { TEST_CLOUD_POSTGRES_HOST: pooledHost.replace('test-branch', 'main') },
  ])('rejects an unsafe cloud target: %j', (patch) => {
    expect(() => requireIsolatedTestDatabase({ ...cloud, ...patch })).toThrow();
  });

  it('allows the existing development DB only after an explicit opt-in with external integrations disabled', () => {
    expect(() => requireIsolatedTestDatabase(development)).not.toThrow();
  });

  it.each([
    { TEST_ALLOW_EXISTING_DATA: undefined },
    { NODE_ENV: 'development' },
    { TEST_DATABASE_URL: pooled },
    { DIRECT_URL: development.DATABASE_URL },
    { DIRECT_URL: development.DIRECT_URL?.replace('postgresql:', 'http:') },
    { TEST_DIRECT_URL: direct },
    { TEST_REDIS_URL: redis.replace('lambe-test', 'lambe-other') },
    { FIREBASE_ENABLED: 'true' },
    { MAIL_ENABLED: 'true' },
    { MOMO_ENABLED: 'true' },
    { SEPAY_ENABLED: 'true' },
    { CLOUDINARY_ENABLED: 'true' },
    { GEMINI_ENABLED: 'true' },
    { REDIS_ENABLED: 'false' },
  ])('rejects unsafe development test settings: %j', (patch) => {
    expect(() =>
      requireIsolatedTestDatabase({ ...development, ...patch }),
    ).toThrow('Development database tests require explicit authorization');
  });
});
