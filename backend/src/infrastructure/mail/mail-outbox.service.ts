import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma, type MailOutbox } from '@prisma/client';
import { PrismaService } from '../persistence/postgres/prisma.service';
import { MailService, type SendMailInput } from './mail.service';

const MAX_ATTEMPTS = 8;

@Injectable()
export class MailOutboxService {
  private readonly logger = new Logger(MailOutboxService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async enqueue(
    input: SendMailInput,
    deduplicationKey: string,
    transaction: Prisma.TransactionClient,
    expiresAt?: Date,
  ): Promise<void> {
    await transaction.mailOutbox.upsert({
      where: { deduplicationKey },
      create: {
        deduplicationKey,
        recipient: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        expiresAt,
      },
      update: {},
    });
  }

  @Interval(30_000)
  async deliverPending(): Promise<void> {
    if (this.processing || !this.mail.isEnabled()) return;
    this.processing = true;
    try {
      await this.prisma.mailOutbox.updateMany({
        where: {
          sentAt: null,
          failedAt: null,
          expiresAt: { lte: new Date() },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
        },
        data: { failedAt: new Date(), text: '', html: '' },
      });
      for (let index = 0; index < 10; index++) {
        // Atomic lease also coordinates multiple API replicas; crashed workers can be reclaimed.
        const rows = await this.prisma.$queryRaw<MailOutbox[]>(Prisma.sql`
          WITH candidate AS (
            SELECT "id" FROM "mail_outbox"
            WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "availableAt" <= NOW()
              AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
              AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
            ORDER BY "availableAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
          )
          UPDATE "mail_outbox" AS mail
          SET "lockedUntil" = date_trunc('milliseconds', NOW()) + INTERVAL '2 minutes', "attempts" = mail."attempts" + 1
          FROM candidate WHERE mail."id" = candidate."id" RETURNING mail.*
        `);
        if (!rows.length) break;
        await this.deliver(rows[0]);
      }
    } catch {
      this.logger.error(
        'Mail outbox processing failed; pending messages will be retried.',
      );
    } finally {
      this.processing = false;
    }
  }

  private async deliver(message: MailOutbox): Promise<void> {
    const lease = {
      id: message.id,
      sentAt: null,
      attempts: message.attempts,
      lockedUntil: message.lockedUntil,
    };
    try {
      await this.mail.send({
        to: message.recipient,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      await this.prisma.mailOutbox.updateMany({
        where: lease,
        data: { sentAt: new Date(), lockedUntil: null, text: '', html: '' },
      });
    } catch {
      const failed = message.attempts >= MAX_ATTEMPTS;
      await this.prisma.mailOutbox.updateMany({
        where: lease,
        data: {
          lockedUntil: null,
          failedAt: failed ? new Date() : null,
          availableAt: new Date(
            Date.now() +
              Math.min(3600, 60 * 2 ** (message.attempts - 1)) * 1000,
          ),
        },
      });
      this.logger.warn(
        `Mail outbox ${message.id}: ${failed ? 'delivery exhausted' : 'retry scheduled'}.`,
      );
    }
  }
}
