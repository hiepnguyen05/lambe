import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InternalRole, Prisma, type MailOutbox } from '@prisma/client';
import { PrismaService } from '../persistence/postgres/prisma.service';
import {
  MailService,
  type SendMailInput,
  smtpErrorDetails,
} from './mail.service';

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

  async enqueueMany(
    items: Array<{
      input: SendMailInput;
      deduplicationKey: string;
      expiresAt?: Date;
    }>,
    transaction: Prisma.TransactionClient,
  ): Promise<number> {
    if (!items.length) return 0;
    const result = await transaction.mailOutbox.createMany({
      data: items.map(({ input, deduplicationKey, expiresAt }) => ({
        deduplicationKey,
        recipient: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        expiresAt,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  @Interval(30_000)
  async deliverPending(source = 'scheduled'): Promise<void> {
    if (this.processing) return;
    if (!this.mail.isEnabled()) {
      if (source !== 'scheduled') {
        this.logger.warn('mail.outbox.skipped_disabled');
      }
      return;
    }
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
        this.logger.log('mail.outbox.delivering');
        await this.deliver(rows[0]);
      }
    } catch (error: unknown) {
      this.logger.error({
        event: 'mail.outbox.processing_failed',
        ...smtpErrorDetails(error),
      });
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
      if (
        message.deduplicationKey.startsWith('order-alert:') ||
        message.deduplicationKey.startsWith('feed-cache-alert:')
      ) {
        const accountId = message.deduplicationKey.split(':').at(-1);
        const account = await this.prisma.internalAccount.findFirst({
          where: {
            id: accountId,
            email: message.recipient,
            status: 'ACTIVE',
            roles: {
              some: {
                role: { in: [InternalRole.ADMIN, InternalRole.SUPPORT] },
                revokedAt: null,
              },
            },
          },
          select: { id: true },
        });
        if (!account) {
          await this.prisma.mailOutbox.updateMany({
            where: lease,
            data: {
              failedAt: new Date(),
              lockedUntil: null,
              text: '',
              html: '',
            },
          });
          return;
        }
      }
      if (message.deduplicationKey.startsWith('feed-notice:')) {
        const notice = await this.prisma.feedNotice.findFirst({
          where: {
            id: message.deduplicationKey.slice('feed-notice:'.length),
            managed: true,
            user: { status: 'ACTIVE' },
            post: {
              provider: {
                user: { status: 'ACTIVE' },
                sourceApplication: { email: message.recipient },
              },
            },
          },
          select: {
            userId: true,
            post: { select: { provider: { select: { userId: true } } } },
          },
        });
        if (!notice || notice.userId !== notice.post.provider.userId) {
          await this.prisma.mailOutbox.updateMany({
            where: lease,
            data: {
              failedAt: new Date(),
              lockedUntil: null,
              text: '',
              html: '',
            },
          });
          return;
        }
      }
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
      this.logger.log('mail.outbox.delivered');
    } catch (error: unknown) {
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
      this.logger.warn({
        event: failed
          ? 'mail.outbox.delivery_exhausted'
          : 'mail.outbox.retry_scheduled',
        ...smtpErrorDetails(error),
      });
    }
  }
}
