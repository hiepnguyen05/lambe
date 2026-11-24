import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('isolated_test_stack_required');
  return value as RecordValue;
}

function localPort(service: RecordValue, published: string, target: number) {
  const ports = service.ports;
  if (!Array.isArray(ports) || ports.length !== 1)
    throw new Error('isolated_test_stack_required');
  const port = record(ports[0]);
  if (
    port.host_ip !== '127.0.0.1' ||
    String(port.published) !== published ||
    port.target !== target
  )
    throw new Error('isolated_test_stack_required');
}

export function assertIsolatedBenchmarkStack(value: unknown): void {
  const config = record(value);
  const services = record(config.services);
  if (
    config.name !== 'lambe-test' ||
    Object.keys(services).sort().join(',') !== 'postgres,redis'
  )
    throw new Error('isolated_test_stack_required');
  const postgres = record(services.postgres);
  const redis = record(services.redis);
  const environment = record(postgres.environment);
  if (
    postgres.image !== 'postgres:16-alpine' ||
    redis.image !== 'redis:7-alpine' ||
    environment.POSTGRES_DB !== 'lambe_booking_test_local' ||
    environment.POSTGRES_USER !== 'lambe_test' ||
    environment.POSTGRES_PASSWORD !== 'lambe_test_only' ||
    !Array.isArray(postgres.tmpfs) ||
    !postgres.tmpfs.includes('/var/lib/postgresql/data') ||
    postgres.volumes ||
    redis.volumes
  )
    throw new Error('isolated_test_stack_required');
  localPort(postgres, '55432', 5432);
  localPort(redis, '56379', 6379);
}

function main() {
  if (process.argv.slice(2).join(' ') !== '--run')
    throw new Error('explicit_run_required');
  const backend = resolve(__dirname, '../..');
  const compose = resolve(backend, 'docker-compose.test.yml');
  const args = ['compose', '-f', compose];
  const config = JSON.parse(
    execFileSync('docker', [...args, 'config', '--format', 'json'], {
      cwd: backend,
      encoding: 'utf8',
    }),
  ) as unknown;
  assertIsolatedBenchmarkStack(config);
  execFileSync('docker', [...args, 'down'], { cwd: backend, stdio: 'inherit' });
  execFileSync('docker', [...args, 'up', '-d', '--wait'], {
    cwd: backend,
    stdio: 'inherit',
  });
  const databaseUrl =
    'postgresql://lambe_test:lambe_test_only@127.0.0.1:55432/lambe_booking_test_local';
  execFileSync(
    process.execPath,
    [
      resolve(backend, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
    ],
    {
      cwd: backend,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
        REDIS_URL: 'redis://127.0.0.1:56379/15',
      },
    },
  );
}

if (require.main === module) main();
