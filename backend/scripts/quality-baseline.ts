import { performance } from 'node:perf_hooks';
import { readdirSync } from 'node:fs';

export function currentFileDescriptors(): number | null {
  if (process.platform !== 'linux') return null;
  try {
    return readdirSync('/proc/self/fd').length;
  } catch {
    return null;
  }
}

export const bounds = {
  providers: [200, 10, 500],
  orders: [1000, 1000, 10000],
  messages: [1000, 1000, 10000],
  samples: [100, 20, 500],
  concurrency: [4, 1, 16],
  sse: [12, 2, 30],
  warmup: [5, 1, 20],
} as const;
export type Options = Record<keyof typeof bounds, number>;

// No dotenv or application imports before these checks: .env must never select appDB.
export function preflight(args: string[], env: NodeJS.ProcessEnv): Options {
  if (!args.includes('--run')) throw new Error('explicit_run_required');
  if (env.NODE_ENV !== 'test') throw new Error('node_env_test_required');
  if (!env.DATABASE_URL || env.DATABASE_URL !== env.TEST_DATABASE_URL)
    throw new Error('identical_explicit_test_urls_required');
  try {
    const db = new URL(env.DATABASE_URL);
    const redis = new URL(env.REDIS_URL ?? '');
    const local = (host: string) =>
      ['localhost', '127.0.0.1', '[::1]'].includes(host);
    if (
      !['postgres:', 'postgresql:'].includes(db.protocol) ||
      !local(db.hostname) ||
      !/^\/lambe_booking_test_[a-z0-9_]+$/.test(db.pathname) ||
      db.hash ||
      [...db.searchParams].some(
        ([key, value]) => key !== 'schema' || value !== 'public',
      ) ||
      !['redis:', 'rediss:'].includes(redis.protocol) ||
      !local(redis.hostname) ||
      redis.pathname !== '/15' ||
      redis.search ||
      redis.hash
    )
      throw new Error();
  } catch {
    throw new Error('isolated_local_postgres_and_redis15_required');
  }
  const options = Object.fromEntries(
    Object.entries(bounds).map(([key, [value]]) => [key, value]),
  ) as Options;
  const seen = new Set<string>();
  for (const arg of args) {
    if (arg === '--run') continue;
    const match = /^--([a-z]+)=([0-9]+)$/.exec(arg);
    if (!match || !(match[1] in bounds) || seen.has(match[1]))
      throw new Error('invalid_option');
    const key = match[1] as keyof Options;
    const value = Number(match[2]);
    const [, min, max] = bounds[key];
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error('option_out_of_bounds');
    options[key] = value;
    seen.add(key);
  }
  return options;
}

export function percentiles(values: number[]) {
  if (!values.length || values.some((n) => !Number.isFinite(n) || n < 0))
    throw new Error('invalid_samples');
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) =>
    Number(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)].toFixed(3));
  return { samples: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}

export async function measure(
  samples: number,
  concurrency: number,
  run: () => Promise<void>,
) {
  const values: number[] = [];
  let next = 0;
  const started = performance.now();
  // Wait for every in-flight worker even on failure before closing the app/database.
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(samples, concurrency) }, async () => {
      while (next++ < samples) {
        const start = performance.now();
        await run();
        values.push(performance.now() - start);
      }
    }),
  );
  if (workers.some((worker) => worker.status === 'rejected'))
    throw new Error('measurement_failed');
  return {
    latencyMs: percentiles(values),
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    concurrency,
  };
}

async function main() {
  const write = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  let stage = 'preflight';
  try {
    const options = preflight(process.argv.slice(2), process.env);
    // App/Prisma logs and exception bodies can contain credentials or synthetic payloads.
    process.stdout.write = () => true;
    process.stderr.write = () => true;
    stage = 'bootstrap';
    const { runBaseline } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../test/quality-baseline.runner') as typeof import('../test/quality-baseline.runner');
    const report = await runBaseline(options, (value) => {
      stage = value;
    });
    write(JSON.stringify(report) + '\n');
    if (report.status !== 'passed') process.exitCode = 1;
  } catch {
    write(
      JSON.stringify({
        status: 'refused_or_failed',
        stage,
        error: 'See documented guards and setup; raw errors suppressed.',
      }) + '\n',
    );
    process.exitCode = 1;
  } finally {
    process.stdout.write = write;
    process.stderr.write = stderr;
  }
}

if (require.main === module) void main();
