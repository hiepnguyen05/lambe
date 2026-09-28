import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  enabled: process.env.MAIL_ENABLED === 'true',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  user: process.env.SMTP_USER || '',
  appPassword: (process.env.SMTP_APP_PASSWORD || '').replace(/\s+/g, ''),
  fromName: process.env.MAIL_FROM_NAME || 'Lambe Home Beauty',
  replyTo: process.env.MAIL_REPLY_TO || '',
  connectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
}));
