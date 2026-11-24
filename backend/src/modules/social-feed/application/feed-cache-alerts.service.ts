import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { MailOutboxService } from '../../../infrastructure/mail/mail-outbox.service';
import { FeedCacheWorkerService } from './feed-cache-worker.service';

@Injectable()
export class FeedCacheAlertsService {
  private processing = false;
  private readonly logger = new Logger(FeedCacheAlertsService.name);
  constructor(
    private readonly worker: FeedCacheWorkerService,
    private readonly prisma: PrismaService,
    private readonly mail: MailOutboxService,
    private readonly config: ConfigService,
  ) {}

  @Interval(60000)
  async scan(): Promise<void> {
    if (
      this.processing ||
      !this.config.get<boolean>('cache.feedEnabled', false)
    )
      return;
    this.processing = true;
    try {
      const status = await this.worker.status();
      if (!status.alerts.length) return;
      const accounts = await this.prisma.internalAccount.findMany({
        where: {
          status: 'ACTIVE',
          email: { not: null },
          roles: {
            some: { revokedAt: null, role: { in: ['ADMIN', 'SUPPORT'] } },
          },
        },
        select: { id: true, email: true },
        take: 50,
      });
      const hour = Math.floor(Date.now() / 3600000);
      for (const account of accounts) {
        if (!account.email) continue;
        const text = `Feed cache alerts: ${status.alerts.join(', ')}. Pending: ${status.pending}. Oldest age: ${Math.round(status.oldestAgeSeconds)} seconds. Inspect /api/internal/feed/cache/status.`;
        await this.prisma.$transaction((tx) =>
          this.mail.enqueue(
            {
              to: account.email!,
              subject: '[Lambe] Feed cache cần kiểm tra',
              text,
              html: `<p>${text}</p>`,
            },
            `feed-cache-alert:${hour}:${account.id}`,
            tx,
          ),
        );
      }
    } catch {
      this.logger.error('feed.cache_alert.scan_failed');
    } finally {
      this.processing = false;
    }
  }
}
