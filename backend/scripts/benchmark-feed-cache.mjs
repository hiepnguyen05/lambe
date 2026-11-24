import { performance } from 'node:perf_hooks';

// Read-only probe. Start the same server/data first with cache off, then on.
const base = new URL(
  process.env.FEED_BENCH_BASE_URL ?? 'http://localhost:5000/api/',
);
if (
  !['http:', 'https:'].includes(base.protocol) ||
  base.username ||
  base.password
) {
  throw new Error(
    'FEED_BENCH_BASE_URL must be an HTTP(S) URL without credentials',
  );
}
const samples = Number(process.env.FEED_BENCH_REQUESTS ?? 100);
const concurrency = Number(process.env.FEED_BENCH_CONCURRENCY ?? 5);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 10000 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 50
) {
  throw new Error('Use 1–10000 requests and 1–50 concurrent readers');
}
const postId = process.env.FEED_BENCH_POST_ID;
if (postId && !/^[a-f0-9-]{36}$/i.test(postId))
  throw new Error('Invalid FEED_BENCH_POST_ID');
const prefix = base.href.endsWith('/') ? base.href : `${base.href}/`;
const paths = [
  'feed/posts?limit=20',
  ...(postId ? [`feed/posts/${postId}`] : []),
];
const report = {
  capturedAt: new Date().toISOString(),
  mode: process.env.FEED_BENCH_LABEL ?? 'baseline',
  samples,
  concurrency,
  endpoints: [],
};
for (const path of paths) {
  const durations = [];
  let failures = 0;
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(concurrency, samples) }, async () => {
      while (next++ < samples) {
        const at = performance.now();
        try {
          const response = await fetch(new URL(path, prefix), {
            signal: AbortSignal.timeout(10000),
          });
          const value = await response.json();
          if (!response.ok || value.success !== true) failures++;
          else durations.push(performance.now() - at);
        } catch {
          failures++;
        }
      }
    }),
  );
  durations.sort((a, b) => a - b);
  const percentile = (p) =>
    durations.length
      ? Number(
          durations[
            Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)
          ].toFixed(2),
        )
      : null;
  report.endpoints.push({
    path,
    successes: durations.length,
    failures,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    elapsedMs: Math.round(performance.now() - started),
  });
}
console.log(JSON.stringify(report, null, 2));
if (report.endpoints.some((endpoint) => endpoint.failures))
  process.exitCode = 1;
