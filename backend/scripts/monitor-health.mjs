import 'dotenv/config';
import nodemailer from 'nodemailer';
import { pathToFileURL } from 'node:url';

export function createMonitor({ probe, notify, failureThreshold = 3 }) {
  let failures = 0;
  let alerted = false;
  return async () => {
    const healthy = await probe();
    if (healthy) {
      if (alerted) await notify('recovered');
      failures = 0;
      alerted = false;
    } else {
      failures++;
      if (failures >= failureThreshold && !alerted) {
        await notify('down');
        alerted = true;
      }
    }
    return { healthy, failures, alerted };
  };
}

export async function probeHealth(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      body?.data?.status === 'ok' &&
      body.data.services?.database === 'up' &&
      body.data.services?.cache === 'up'
    );
  } catch {
    return false;
  }
}

async function main() {
  const url = new URL(process.env.MONITOR_HEALTH_URL ?? '');
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('MONITOR_HEALTH_URL must be a plain HTTP(S) health URL.');
  }
  if (process.argv.includes('--probe-only')) {
    const healthy = await probeHealth(url);
    console.log(healthy ? 'health=ok' : 'health=unavailable');
    if (!healthy) process.exitCode = 1;
    return;
  }
  const recipients = (process.env.OPS_ALERT_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  if (recipients.some((email) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    throw new Error('OPS_ALERT_EMAILS contains an invalid email address.');
  }
  if (
    !recipients.length ||
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_APP_PASSWORD
  ) {
    throw new Error('Configure OPS_ALERT_EMAILS and SMTP credentials.');
  }
  const intervalMs = Number(process.env.MONITOR_INTERVAL_SECONDS ?? 60) * 1_000;
  if (!Number.isInteger(intervalMs) || intervalMs < 10_000) {
    throw new Error('MONITOR_INTERVAL_SECONDS must be at least 10.');
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD,
    },
  });
  if (process.argv.includes('--send-test')) {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to: recipients,
      subject: 'Lambe: kiểm tra kênh cảnh báo',
      text: 'Đây là email kiểm tra kênh cảnh báo vận hành Lambe.',
    });
    console.log('alert=test-sent');
    return;
  }
  const check = createMonitor({
    probe: () => probeHealth(url),
    notify: async (state) => {
      await transport.sendMail({
        from: process.env.SMTP_USER,
        to: recipients,
        subject:
          state === 'down'
            ? 'Lambe: backend không sẵn sàng'
            : 'Lambe: backend đã phục hồi',
        text: `Trạng thái API: ${state}. Kiểm tra dịch vụ và nhật ký vận hành.`,
      });
      console.log(`alert=${state}`);
    },
  });
  for (;;) {
    try {
      const result = await check();
      console.log(
        `health=${result.healthy ? 'ok' : 'unavailable'} failures=${result.failures}`,
      );
    } catch {
      // Retry on the next cycle; the failure alert remains unsent until SMTP succeeds.
      console.error('Health alert delivery failed; retrying.');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
