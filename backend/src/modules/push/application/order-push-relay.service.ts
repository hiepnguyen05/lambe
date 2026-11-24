import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { PushOutboxService } from './push-outbox.service';
import {
  canReceiveOrderPush,
  orderPushAudienceSelect,
} from '../../orders/application/notifications/order-notification-recipient.policy';

@Injectable()
export class OrderPushRelayService {
  private readonly logger = new Logger(OrderPushRelayService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: PushOutboxService,
  ) {}

  @Interval(2_000)
  async enqueuePending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const rows = await this.prisma.orderNotification.findMany({
        where: { pushQueuedAt: null },
        select: {
          id: true,
          userId: true,
          orderId: true,
          event: true,
          order: { select: orderPushAudienceSelect },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 100,
      });
      for (const row of rows) {
        await this.prisma.$transaction(async (tx) => {
          if (canReceiveOrderPush(row.order, row.userId, row.event))
            await this.outbox.enqueue(tx, {
              userId: row.userId,
              sourceId: row.id,
              event: row.event,
              entityType: 'ORDER',
              entityId: row.orderId,
              recipientRole:
                row.order.customerId === row.userId ? 'CUSTOMER' : 'PROVIDER',
            });
          await tx.orderNotification.updateMany({
            where: { id: row.id, pushQueuedAt: null },
            data: { pushQueuedAt: new Date() },
          });
        });
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Order push relay paused: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    } finally {
      this.processing = false;
    }
  }
}
