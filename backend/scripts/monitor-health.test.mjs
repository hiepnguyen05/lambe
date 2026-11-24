import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMonitor } from './monitor-health.mjs';

test('alerts after three failures, once per outage, then announces recovery', async () => {
  let healthy = false;
  const notifications = [];
  const check = createMonitor({
    probe: async () => healthy,
    notify: async (state) => notifications.push(state),
  });
  await check();
  await check();
  assert.deepEqual(notifications, []);
  await check();
  await check();
  assert.deepEqual(notifications, ['down']);
  healthy = true;
  await check();
  await check();
  assert.deepEqual(notifications, ['down', 'recovered']);
});

test('retries an alert when email delivery fails', async () => {
  let attempts = 0;
  const check = createMonitor({
    probe: async () => false,
    failureThreshold: 1,
    notify: async () => {
      attempts++;
      if (attempts === 1) throw new Error('SMTP unavailable');
    },
  });
  await assert.rejects(check(), /SMTP unavailable/);
  assert.deepEqual(await check(), {
    healthy: false,
    failures: 2,
    alerted: true,
  });
  assert.equal(attempts, 2);
});
