import { assertIsolatedBenchmarkStack } from './reset-isolated-benchmark';

describe('isolated benchmark stack reset guard', () => {
  const config = () => ({
    name: 'lambe-test',
    services: {
      postgres: {
        image: 'postgres:16-alpine',
        environment: {
          POSTGRES_DB: 'lambe_booking_test_local',
          POSTGRES_USER: 'lambe_test',
          POSTGRES_PASSWORD: 'lambe_test_only',
        },
        ports: [{ host_ip: '127.0.0.1', published: '55432', target: 5432 }],
        tmpfs: ['/var/lib/postgresql/data'],
      },
      redis: {
        image: 'redis:7-alpine',
        ports: [{ host_ip: '127.0.0.1', published: '56379', target: 6379 }],
      },
    },
  });

  it('accepts only the hardcoded disposable local stack', () => {
    expect(() => assertIsolatedBenchmarkStack(config())).not.toThrow();
    for (const alter of [
      (value: ReturnType<typeof config>) => (value.name = 'lambe'),
      (value: ReturnType<typeof config>) =>
        (value.services.postgres.ports[0].host_ip = '0.0.0.0'),
      (value: ReturnType<typeof config>) =>
        (value.services.postgres.environment.POSTGRES_DB = 'production'),
      (value: ReturnType<typeof config>) =>
        (value.services.redis.ports[0].published = '6379'),
      (value: ReturnType<typeof config>) =>
        (value.services.postgres.tmpfs = []),
    ]) {
      const value = config();
      alter(value);
      expect(() => assertIsolatedBenchmarkStack(value)).toThrow(
        'isolated_test_stack_required',
      );
    }
  });
});
