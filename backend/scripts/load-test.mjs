import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

export const percentile = (sorted, ratio) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
    : null;

export const parseStages = (value) => {
  const stages = value.split(',').map(Number);
  if (
    !stages.length ||
    stages.some(
      (stage) => !Number.isInteger(stage) || stage < 1 || stage > 1000,
    )
  ) {
    throw new Error('LOAD_TEST_STAGES must contain integers from 1 to 1000');
  }
  return stages;
};

if (process.argv.includes('--self-test')) {
  assert.deepEqual(parseStages('50,200,1000'), [50, 200, 1000]);
  assert.equal(percentile([1, 2, 3, 4], 0.95), 4);
  console.log('load-test self-check passed');
  process.exit(0);
}

const baseUrl = new URL(
  process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:5001',
);
if (
  !['http:', 'https:'].includes(baseUrl.protocol) ||
  baseUrl.username ||
  baseUrl.password
) {
  throw new Error(
    'LOAD_TEST_BASE_URL must be an HTTP(S) URL without credentials',
  );
}
if (
  process.env.LOAD_TEST_ALLOW_REMOTE !== 'true' &&
  !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
) {
  throw new Error('Remote load tests require LOAD_TEST_ALLOW_REMOTE=true');
}

const stages = parseStages(process.env.LOAD_TEST_STAGES ?? '50,200,500,1000');
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_SECONDS ?? 10);
const thinkTimeMs = Number(process.env.LOAD_TEST_THINK_TIME_MS ?? 1000);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 5000);
const maxErrorRate = Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? 0.01);
const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 750);
const stopOnFailure = process.env.LOAD_TEST_STOP_ON_FAILURE !== 'false';
const paths = (
  process.env.LOAD_TEST_PATHS ??
  '/api/categories?limit=20,/api/services,/api/feed/posts?limit=20,/api/health'
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

if (
  !Number.isFinite(durationSeconds) ||
  durationSeconds < 1 ||
  durationSeconds > 300 ||
  !Number.isFinite(thinkTimeMs) ||
  thinkTimeMs < 0 ||
  thinkTimeMs > 60_000 ||
  !Number.isFinite(timeoutMs) ||
  timeoutMs < 100 ||
  timeoutMs > 60_000 ||
  !Number.isFinite(maxErrorRate) ||
  maxErrorRate < 0 ||
  maxErrorRate > 1 ||
  !Number.isFinite(maxP95Ms) ||
  maxP95Ms < 1 ||
  !paths.length ||
  paths.some((path) => !path.startsWith('/'))
) {
  throw new Error('Invalid load-test configuration');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  capturedAt: new Date().toISOString(),
  baseUrl: `${baseUrl.protocol}//${baseUrl.host}`,
  durationSeconds,
  thinkTimeMs,
  thresholds: { maxErrorRate, maxP95Ms },
  stages: [],
};

for (const concurrency of stages) {
  const endAt = performance.now() + durationSeconds * 1000;
  const latencies = [];
  const statuses = {};
  const endpoints = Object.fromEntries(
    paths.map((path) => [path, { requests: 0, failures: 0, latencies: [] }]),
  );
  let requests = 0;
  let failures = 0;
  let cursor = 0;
  const startedAt = performance.now();

  await Promise.all(
    Array.from({ length: concurrency }, (_, worker) =>
      (async () => {
        const clientIp = `198.18.${Math.floor(worker / 250)}.${(worker % 250) + 1}`;
        while (performance.now() < endAt) {
          const iterationStartedAt = performance.now();
          const path = paths[cursor++ % paths.length];
          const endpoint = endpoints[path];
          try {
            const response = await fetch(new URL(path, baseUrl), {
              headers: { 'x-forwarded-for': clientIp },
              signal: AbortSignal.timeout(timeoutMs),
            });
            await response.arrayBuffer();
            statuses[response.status] = (statuses[response.status] ?? 0) + 1;
            if (!response.ok) {
              failures++;
              endpoint.failures++;
            } else {
              const duration = performance.now() - iterationStartedAt;
              latencies.push(duration);
              endpoint.latencies.push(duration);
            }
          } catch {
            statuses.networkError = (statuses.networkError ?? 0) + 1;
            failures++;
            endpoint.failures++;
          }
          requests++;
          endpoint.requests++;
          const remainingThinkTime =
            thinkTimeMs - (performance.now() - iterationStartedAt);
          if (remainingThinkTime > 0) await sleep(remainingThinkTime);
        }
      })(),
    ),
  );

  latencies.sort((a, b) => a - b);
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const p95Ms = percentile(latencies, 0.95);
  const errorRate = requests ? failures / requests : 1;
  const passed =
    errorRate <= maxErrorRate && p95Ms !== null && p95Ms <= maxP95Ms;
  report.stages.push({
    concurrency,
    requests,
    requestsPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
    successes: requests - failures,
    failures,
    errorRate: Number(errorRate.toFixed(4)),
    p50Ms: percentile(latencies, 0.5)?.toFixed(2) ?? null,
    p95Ms: p95Ms?.toFixed(2) ?? null,
    p99Ms: percentile(latencies, 0.99)?.toFixed(2) ?? null,
    statuses,
    endpoints: Object.fromEntries(
      Object.entries(endpoints).map(([path, endpoint]) => {
        endpoint.latencies.sort((a, b) => a - b);
        return [
          path,
          {
            requests: endpoint.requests,
            failures: endpoint.failures,
            p95Ms: percentile(endpoint.latencies, 0.95)?.toFixed(2) ?? null,
          },
        ];
      }),
    ),
    passed,
  });
  if (!passed && stopOnFailure) break;
}

console.log(JSON.stringify(report, null, 2));
if (
  report.stages.length !== stages.length ||
  report.stages.some((stage) => !stage.passed)
) {
  process.exitCode = 2;
}
