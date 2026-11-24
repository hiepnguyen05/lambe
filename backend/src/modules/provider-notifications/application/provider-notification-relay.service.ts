import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { PushOutboxService } from '../../push/application/push-outbox.service';
import { ProviderNotificationSignalsService } from './provider-notification-signals.service';

@Injectable()
export class ProviderNotificationRelayService {
  private readonly logger = new Logger(ProviderNotificationRelayService.name);
  private processing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly signals: ProviderNotificationSignalsService,
    private readonly cache: RedisCacheService,
    private readonly outbox: PushOutboxService,
  ) {}

  @Interval(1_000)
  async tick() {
    if (process.env.NODE_ENV !== 'test') await this.flush();
  }

  async flush() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.signals.flush();
      await this.assignSequences();
      const rows = await this.prisma.providerOperationalNotification.findMany({
        where: { pushQueuedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 100,
      });
      for (const row of rows) {
        if (!row.pushQueuedAt)
          await this.prisma.$transaction(async (tx) => {
            if (!row.resolvedAt)
              await this.outbox.enqueue(tx, {
                userId: row.userId,
                sourceId: row.id,
                event: row.event,
                entityType: 'PROVIDER_NOTIFICATION',
                entityId: row.id,
                recipientRole: 'PROVIDER_OWNER',
              });
            await tx.providerOperationalNotification.updateMany({
              where: { id: row.id, pushQueuedAt: null },
              data: { pushQueuedAt: new Date() },
            });
          });
      }
      if (this.cache.getStatus() === 'up') {
        const pending =
          await this.prisma.providerOperationalNotification.findMany({
            where: { publishedAt: null, streamSequence: { not: null } },
            select: { id: true, userId: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 100,
          });
        for (const row of pending) {
          await this.cache.publishOrderNotification(row.userId);
          await this.prisma.providerOperationalNotification.updateMany({
            where: { id: row.id, publishedAt: null },
            data: { publishedAt: new Date() },
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Provider notification relay paused: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    } finally {
      this.processing = false;
    }
  }

  private async assignSequences() {
    const rows = await this.prisma.providerOperationalNotification.findMany({
      where: { streamSequence: null },
      select: { id: true, providerId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    for (const row of rows)
      await this.prisma.$transaction(async (tx) => {
        const provider = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM provider_profiles WHERE id=${row.providerId} FOR SHARE SKIP LOCKED`,
        );
        if (!provider.length) return;
        // The counter lock lives until commit: later publishers cannot expose a higher sequence first.
        const counter = await tx.providerNotificationCounter.upsert({
          where: { providerId: row.providerId },
          create: { providerId: row.providerId, lastSequence: 1n },
          update: { lastSequence: { increment: 1 } },
        });
        await tx.providerOperationalNotification.updateMany({
          where: { id: row.id, streamSequence: null },
          data: { streamSequence: counter.lastSequence },
        });
      });
  }
}
