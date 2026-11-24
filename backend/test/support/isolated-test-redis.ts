/** Only disposable loopback Redis DB15 may be used for fault/fixture tests. */
export function requireIsolatedTestRedis(env: NodeJS.ProcessEnv): string {
  try {
    const url = new URL(env.REDIS_URL ?? '');
    if (
      env.NODE_ENV === 'test' &&
      url.protocol === 'redis:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      url.pathname === '/15' &&
      !url.search &&
      !url.hash
    )
      return env.REDIS_URL!;
  } catch {
    // Fail before constructing a client or writing fixtures.
  }
  throw new Error(
    'Tests require NODE_ENV=test and explicit loopback Redis DB 15.',
  );
}
