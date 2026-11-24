const TEST_DATABASE_NAME = /^\/lambe_booking_test_[a-z0-9_]+$/;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function validPostgresUrl(value: string | undefined): URL | null {
  try {
    const url = new URL(value ?? '');
    return ['postgres:', 'postgresql:'].includes(url.protocol) &&
      TEST_DATABASE_NAME.test(url.pathname) &&
      !url.hash &&
      [...url.searchParams].every(
        ([key, setting]) =>
          (key === 'schema' && setting === 'public') ||
          (key === 'sslmode' && setting === 'require') ||
          (key === 'channel_binding' && setting === 'require'),
      )
      ? url
      : null;
  } catch {
    return null;
  }
}

function isolatedCloudTarget(env: NodeJS.ProcessEnv): boolean {
  const pooled = validPostgresUrl(env.TEST_DATABASE_URL);
  const direct = validPostgresUrl(env.TEST_DIRECT_URL);
  if (!pooled || !direct) return false;
  let redis: URL;
  try {
    redis = new URL(env.TEST_REDIS_URL ?? '');
  } catch {
    return false;
  }
  const pooledHost = env.TEST_CLOUD_POSTGRES_HOST;
  const redisHost = env.TEST_CLOUD_REDIS_HOST;
  return (
    env.NODE_ENV === 'test' &&
    env.TEST_TARGET === 'cloud' &&
    env.DATABASE_URL === env.TEST_DATABASE_URL &&
    env.DIRECT_URL === env.TEST_DIRECT_URL &&
    env.REDIS_ENABLED === 'true' &&
    env.REDIS_URL === env.TEST_REDIS_URL &&
    typeof pooledHost === 'string' &&
    /^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(pooledHost) &&
    pooled.hostname === pooledHost &&
    (!pooled.port || pooled.port === '5432') &&
    direct.hostname === pooledHost.replace('-pooler.', '.') &&
    (!direct.port || direct.port === '5432') &&
    pooled.pathname === direct.pathname &&
    pooled.username === direct.username &&
    pooled.password === direct.password &&
    pooled.searchParams.get('sslmode') === 'require' &&
    direct.searchParams.get('sslmode') === 'require' &&
    typeof redisHost === 'string' &&
    /^[a-z0-9-]+\.upstash\.io$/.test(redisHost) &&
    redis.protocol === 'rediss:' &&
    redis.hostname === redisHost &&
    redis.port === '6379' &&
    Boolean(redis.username && redis.password) &&
    (!redis.pathname || redis.pathname === '/0') &&
    !redis.search &&
    !redis.hash
  );
}

function authorizedDevelopmentTarget(env: NodeJS.ProcessEnv): boolean {
  let pooled: URL, direct: URL, redis: URL;
  try {
    pooled = new URL(env.DATABASE_URL ?? '');
    direct = new URL(env.DIRECT_URL ?? '');
    redis = new URL(env.REDIS_URL ?? '');
  } catch {
    return false;
  }
  const disabledIntegrations = [
    'FIREBASE_ENABLED',
    'CLOUDINARY_ENABLED',
    'MAIL_ENABLED',
    'MOMO_ENABLED',
    'SEPAY_ENABLED',
    'GEMINI_ENABLED',
    'GEMINI_WEB_SEARCH_ENABLED',
  ];
  return (
    env.NODE_ENV === 'test' &&
    env.TEST_TARGET === 'development' &&
    env.TEST_ALLOW_EXISTING_DATA === 'lambe-dev-tests-authorized' &&
    env.DATABASE_URL === env.TEST_DATABASE_URL &&
    env.DIRECT_URL === env.TEST_DIRECT_URL &&
    env.REDIS_URL === env.TEST_REDIS_URL &&
    env.REDIS_ENABLED === 'true' &&
    disabledIntegrations.every((name) => env[name] === 'false') &&
    ['postgres:', 'postgresql:'].includes(pooled.protocol) &&
    ['postgres:', 'postgresql:'].includes(direct.protocol) &&
    pooled.hostname.endsWith('.neon.tech') &&
    pooled.hostname.includes('-pooler.') &&
    direct.hostname === pooled.hostname.replace('-pooler.', '.') &&
    pooled.pathname === direct.pathname &&
    pooled.username === direct.username &&
    pooled.password === direct.password &&
    pooled.searchParams.get('sslmode') === 'require' &&
    direct.searchParams.get('sslmode') === 'require' &&
    redis.protocol === 'rediss:' &&
    redis.hostname.endsWith('.upstash.io') &&
    Boolean(redis.username && redis.password)
  );
}

export function requireIsolatedTestDatabase(env: NodeJS.ProcessEnv): void {
  if (env.TEST_TARGET === 'development') {
    if (authorizedDevelopmentTarget(env)) return;
    throw new Error(
      'Development database tests require explicit authorization, matching test URLs and disabled external integrations.',
    );
  }
  if (env.TEST_TARGET === 'cloud') {
    if (isolatedCloudTarget(env)) return;
    throw new Error(
      'Cloud tests require a separate lambe_booking_test_* Neon database, matching pooled/direct URLs and a dedicated Upstash TLS URL.',
    );
  }
  let isolated = false;
  try {
    const database = validPostgresUrl(env.TEST_DATABASE_URL);
    isolated =
      env.NODE_ENV === 'test' &&
      (!env.TEST_TARGET || env.TEST_TARGET === 'local') &&
      Boolean(env.TEST_DATABASE_URL) &&
      env.DATABASE_URL === env.TEST_DATABASE_URL &&
      (!env.DIRECT_URL || env.DIRECT_URL === env.TEST_DATABASE_URL) &&
      database !== null &&
      LOCAL_HOSTS.includes(database.hostname) &&
      [...database.searchParams].every(
        ([key, value]) => key === 'schema' && value === 'public',
      );
  } catch {
    // Fail before Test.compile(), provider initialization, or fixture writes.
  }
  if (!isolated)
    throw new Error(
      'Tests require NODE_ENV=test and matching DATABASE_URL/TEST_DATABASE_URL for a local lambe_booking_test_* database.',
    );
}
