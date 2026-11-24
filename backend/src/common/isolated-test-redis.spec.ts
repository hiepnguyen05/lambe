import { requireIsolatedTestRedis } from '../../test/support/isolated-test-redis';

describe('isolated Redis test target', () => {
  it.each([
    'redis://localhost:6379/15',
    'redis://127.0.0.1:56379/15',
    'redis://[::1]:6379/15',
  ])('accepts explicit loopback DB15 without fixing the port: %s', (url) =>
    expect(requireIsolatedTestRedis({ NODE_ENV: 'test', REDIS_URL: url })).toBe(
      url,
    ),
  );
  it.each([
    undefined,
    'redis://localhost:6379/0',
    'redis://remote.example:6379/15',
    'redis://localhost:6379/15?db=0',
    'redis://localhost:6379/15#0',
    'http://localhost:6379/15',
  ])('rejects missing, remote or overridden targets: %s', (url) =>
    expect(() =>
      requireIsolatedTestRedis({ NODE_ENV: 'test', REDIS_URL: url }),
    ).toThrow(),
  );
  it('refuses production even for a loopback URL', () => {
    expect(() =>
      requireIsolatedTestRedis({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://localhost/15',
      }),
    ).toThrow();
  });
});
