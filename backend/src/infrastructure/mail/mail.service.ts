import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const SMTP_ERROR_CODES = new Set([
  'EAUTH',
  'ECONNECTION',
  'ESOCKET',
  'ETIMEDOUT',
  'EDNS',
  'EENVELOPE',
  'EMESSAGE',
  'ESTREAM',
  'ETLS',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

export function smtpErrorDetails(error: unknown): {
  code?: string;
  responseCode?: number;
} {
  if (!error || typeof error !== 'object') return {};
  const { code, responseCode } = error as Record<string, unknown>;
  return {
    ...(typeof code === 'string' && SMTP_ERROR_CODES.has(code) && { code }),
    ...(typeof responseCode === 'number' &&
      Number.isInteger(responseCode) &&
      responseCode >= 100 &&
      responseCode <= 599 && { responseCode }),
  };
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly enabled: boolean;
  private readonly fromName: string;
  private readonly fromAddress: string;
  private readonly replyTo?: string;
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('mail.enabled', false);
    this.fromName = this.config.get<string>(
      'mail.fromName',
      'Lambe Home Beauty',
    );
    this.fromAddress = this.config.get<string>('mail.user', '');
    this.replyTo = this.config.get<string>('mail.replyTo') || undefined;

    this.transporter = this.enabled
      ? nodemailer.createTransport({
          host: this.config.getOrThrow<string>('mail.host'),
          port: this.config.getOrThrow<number>('mail.port'),
          secure: this.config.getOrThrow<boolean>('mail.secure'),
          auth: {
            user: this.fromAddress,
            pass: this.config.getOrThrow<string>('mail.appPassword'),
          },
          connectionTimeout: this.config.get<number>(
            'mail.connectionTimeoutMs',
            10000,
          ),
          socketTimeout: 60_000,
        })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('mail.delivery.disabled');
      return;
    }

    try {
      await this.transporter.verify();
      this.logger.log('mail.smtp.verified');
    } catch (error: unknown) {
      this.logger.error({
        event: 'mail.smtp.verify_failed',
        ...smtpErrorDetails(error),
      });
    }
  }

  async send(input: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('mail.delivery.skipped_disabled');
      return;
    }

    await this.transporter.sendMail({
      from: { name: this.fromName, address: this.fromAddress },
      replyTo: this.replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }
}
