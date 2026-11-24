import { strict as assert } from 'node:assert';
import { preflight, percentiles, measure } from '../scripts/quality-baseline';
import { queryFamily, safePlan } from './quality-baseline.runner';

async function check() {
  const database =
    'postgresql://test:test@localhost:5433/lambe_booking_test_quality_guard';
  const env = {
    NODE_ENV: 'test',
    DATABASE_URL: database,
    TEST_DATABASE_URL: database,
    REDIS_URL: 'redis://127.0.0.1:6382/15',
  };
  assert.equal(preflight(['--run'], env).providers, 200);
  assert.equal(
    preflight(['--run', '--providers=500', '--sse=30'], env).sse,
    30,
  );
  for (const patch of [
    { NODE_ENV: 'production' },
    { DATABASE_URL: undefined },
    { TEST_DATABASE_URL: undefined },
    { TEST_DATABASE_URL: database + '?schema=public' },
    ...['appDB', 'lambe_booking_test_', 'lambe_booking_test_bad-name'].map(
      (name) => ({
        DATABASE_URL: database.replace(
          'lambe_booking_test_quality_guard',
          name,
        ),
        TEST_DATABASE_URL: database.replace(
          'lambe_booking_test_quality_guard',
          name,
        ),
      }),
    ),
    ...['?options=dbname%3DappDB', '?schema=private'].map((suffix) => ({
      DATABASE_URL: database + suffix,
      TEST_DATABASE_URL: database + suffix,
    })),
    {
      DATABASE_URL: database.replace('localhost', 'example.com'),
      TEST_DATABASE_URL: database.replace('localhost', 'example.com'),
    },
    ...[
      'redis://127.0.0.1:6382/0',
      'redis://127.0.0.1:6382/15?db=0',
      'redis://example.com/15',
      'invalid',
    ].map((REDIS_URL) => ({ REDIS_URL })),
  ])
    assert.throws(() => preflight(['--run'], { ...env, ...patch }));
  for (const args of [
    [],
    ['--providers=200'],
    ['--run', '--orders=999'],
    ['--run', '--messages=999'],
    ['--run', '--providers=501'],
    ['--run', '--sse=31'],
    ['--run', '--concurrency=0'],
    ['--run', '--samples=501'],
    ['--run', '--wat=1'],
    ['--run', '--samples=20', '--samples=30'],
  ])
    assert.throws(() => preflight(args, env));
  assert.deepEqual(percentiles(Array.from({ length: 100 }, (_, i) => i + 1)), {
    samples: 100,
    p50: 50,
    p95: 95,
    p99: 99,
  });
  assert.throws(() => percentiles([]));
  assert.throws(() => percentiles([NaN]));
  let active = 0,
    peak = 0,
    calls = 0;
  const result = await measure(20, 3, async () => {
    active++;
    calls++;
    peak = Math.max(active, peak);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
  });
  assert.equal(calls, 20);
  assert.equal(peak, 3);
  assert.equal(result.latencyMs.samples, 20);
  await assert.rejects(
    measure(4, 2, () => Promise.reject(new Error('synthetic'))),
  );
  const plan = safePlan([
    {
      Plan: {
        'Node Type': 'Index Scan',
        'Actual Rows': 51,
        'Shared Hit Blocks': 4,
        'Index Cond': 'private-id',
        Filter: 'private-payload',
        Output: ['secret'],
        Plans: [{ 'Node Type': 'Limit', 'Actual Rows': 1 }],
      },
      'Execution Time': 0.1,
      Triggers: [{ 'Trigger Name': 'secret', Calls: 1 }],
    },
  ]);
  assert(!JSON.stringify(plan).match(/private|secret|Output|Cond|Filter/));
  assert(JSON.stringify(plan).includes('Shared Hit Blocks'));
  assert.equal(
    queryFamily('SELECT * FROM "public"."feed_posts" WHERE id = $1'),
    'SELECT:feed_posts',
  );
  assert.equal(queryFamily('SELECT 1'), 'SELECT:none');
  console.log(
    JSON.stringify({
      status: 'passed',
      checks: [
        'guards',
        'bounds',
        'percentiles',
        'concurrency',
        'plan_sanitization',
      ],
      databaseConnections: 0,
    }),
  );
}
void check();
