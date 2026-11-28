import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'dotenv';
import { requireIsolatedTestDatabase } from '../test/support/isolated-test-database';
import { bookingFailures } from './booking-test-diagnostics';
import {
  developmentTargets,
  probeDevelopmentCloud,
} from './probe-development-cloud';

const backend = resolve(__dirname, '..');
const disabled = [
  'FIREBASE_ENABLED',
  'CLOUDINARY_ENABLED',
  'MAIL_ENABLED',
  'MOMO_ENABLED',
  'SEPAY_ENABLED',
  'GEMINI_ENABLED',
  'GEMINI_WEB_SEARCH_ENABLED',
] as const;

// Env from .env is copied into this process only; do not modify the user's file.
export function prepareDevelopmentTestEnv(
  contents: string,
  inherited: NodeJS.ProcessEnv = {},
) {
  const values = parse(contents);
  const { databaseUrl, redisUrl } = developmentTargets(contents);
  const env: NodeJS.ProcessEnv = {
    ...inherited,
    ...values,
    NODE_ENV: 'test',
    TEST_TARGET: 'development',
    TEST_ALLOW_EXISTING_DATA: 'lambe-dev-tests-authorized',
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: databaseUrl,
    TEST_DIRECT_URL: values.DIRECT_URL,
    REDIS_URL: redisUrl,
    TEST_REDIS_URL: redisUrl,
    REDIS_ENABLED: 'true',
    OSRM_URL: '',
    JWT_SECRET: 'lambe-cloud-test-user-jwt-synthetic-2026',
    INTERNAL_JWT_SECRET: 'lambe-cloud-test-internal-jwt-synthetic-2026',
    KYC_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  };
  for (const key of disabled) env[key] = 'false';
  requireIsolatedTestDatabase(env);
  return env;
}

function runTool(entry: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: backend,
    env,
    encoding: 'utf8',
    timeout: 15 * 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const summary = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    .split(/\r?\n/)
    .filter((line) => /^(Test Suites:|Tests:|Time:)/.test(line))
    .map((line) => line.trim());
  return {
    status: result.status === 0 ? 'passed' : 'failed',
    summary,
    exitCode: result.status ?? 1,
  };
}

async function main() {
  const action = process.argv[2];
  if (!['check', 'probe', 'status', 'migrate', 'booking'].includes(action)) {
    throw new Error('Expected: check, probe, status, migrate or booking.');
  }
  const contents = readFileSync(resolve(backend, '.env'), 'utf8');
  const env = prepareDevelopmentTestEnv(contents, process.env);
  if (action === 'check') return { status: 'prepared', target: 'development' };
  const probe = await probeDevelopmentCloud(contents);
  if (action === 'probe') return probe;
  if (probe.postgres.status !== 'up')
    return { status: 'failed', phase: 'postgres_connection' };
  if (action === 'booking' && probe.redis.status !== 'up')
    return { status: 'failed', phase: 'redis_connection' };
  if (action === 'booking') {
    const filter = process.argv.indexOf('--testNamePattern');
    if (filter !== -1 && !process.argv[filter + 1])
      throw new Error('Missing test name filter.');
    const report = join(tmpdir(), `lambe-booking-${randomUUID()}.json`);
    try {
      const run = runTool(
        resolve(backend, 'node_modules/jest/bin/jest.js'),
        [
          '--config',
          './test/jest-integration.json',
          'booking.integration-spec.ts',
          '--runInBand',
          '--silent',
          '--json',
          '--outputFile',
          report,
          ...(filter === -1
            ? []
            : ['--testNamePattern', process.argv[filter + 1]]),
        ],
        env,
      );
      let failures: ReturnType<typeof bookingFailures> = [];
      try {
        failures = bookingFailures(JSON.parse(readFileSync(report, 'utf8')));
      } catch {
        // Jest can fail before it writes a structured test report.
      }
      return { phase: 'booking_integration', ...run, failures };
    } finally {
      try {
        unlinkSync(report);
      } catch {
        // The report was not created, or Jest already removed it.
      }
    }
  }
  return {
    phase: action === 'status' ? 'migration_status' : 'migration_deploy',
    ...runTool(
      resolve(backend, 'node_modules/prisma/build/index.js'),
      ['migrate', action === 'status' ? 'status' : 'deploy'],
      env,
    ),
  };
}

if (require.main === module) {
  void main()
    .then((value) => {
      process.stdout.write(JSON.stringify(value) + '\n');
      if ('status' in value && value.status === 'failed') process.exitCode = 1;
      if ('postgres' in value && value.postgres.status !== 'up')
        process.exitCode = 1;
      if ('redis' in value && value.redis.status !== 'up') process.exitCode = 1;
    })
    .catch(() => {
      process.stdout.write('{"status":"refused_or_failed"}\n');
      process.exitCode = 1;
    });
}
