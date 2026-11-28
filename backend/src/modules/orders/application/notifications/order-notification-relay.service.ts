import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  currentRequestId,
  runWithRequestId,
} from '../../../../common/http/request-context';
import { ObservabilityMetrics } from '../../../../infrastructure/observability/observability-metrics.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../../../../infrastructure/cache/redis-cache.service';
import { OrderPushRelayService } from '../../../push/application/order-push-relay.service';

@Injectable()
export class OrderNotificationRelayService implements OnModuleInit {
  private readonly logger = new Logger(OrderNotificationRelayService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
    @Optional() private readonly pushRelay?: OrderPushRelayService,
  ) {}

  onModuleInit() {
    void this.tick();
  }

  @Interval(1_000)
  tick() {
    return this.publishNew();
  }

  async publishNow(userId: string, notificationId?: string): Promise<void> {
    if (this.cache.getStatus() === 'up') {
      try {
        await this.cache.publishOrderNotification(userId);
        if (notificationId) {
          await this.prisma.orderNotification.updateMany({
            where: { id: notificationId, publishedAt: null },
            data: { publishedAt: new Date() },
          });
        }
      } catch {
        // Fall back to the 1s interval relay if immediate publish fails.
      }
    }
    void this.pushRelay?.enqueueAndDeliverNow();
  }

  private async publishNew() {
    if (this.running || this.cache.getStatus() !== 'up') return;
    this.running = true;
    return runWithRequestId(undefined, async () => {
      const counts = { published: 0, errors: 0 };
      try {
        const rows = await this.prisma.orderNotification.findMany({
          where: { publishedAt: null },
          select: { id: true, userId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 100,
        });
        for (const row of rows) {
          await this.cache.publishOrderNotification(row.userId);
          await this.prisma.orderNotification.updateMany({
            where: { id: row.id, publishedAt: null },
            data: { publishedAt: new Date() },
          });
          counts.published++;
        }
      } catch {
        counts.errors++;
      } finally {
        this.running = false;
        this.metrics?.recordWorkerRun(
          'order-notice-relay',
          counts.errors ? 'error' : 'ok',
        );
        const summary = {
          event: 'order-notice-relay.poll',
          requestId: currentRequestId(),
          counts,
        };
        if (counts.errors) this.logger.warn(summary);
        else if (counts.published) this.logger.log(summary);
      }
    });
  }
}
