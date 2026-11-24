import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { OrderNotificationQueryDto } from '../../dto/order-notification-query.dto';
import { orderNotificationScope } from './order-notification-recipient.policy';

@Injectable()
export class OrderNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: OrderNotificationQueryDto = {}) {
    const limit = query.limit ?? 50;
    const where: Prisma.OrderNotificationWhereInput =
      orderNotificationScope(userId);
    if (query.cursor) {
      const cursor = await this.prisma.orderNotification.findFirst({
        where: { id: query.cursor, ...orderNotificationScope(userId) },
        select: { createdAt: true },
      });
      if (!cursor)
        throw new BadRequestException('Thông báo phân trang không hợp lệ.');
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: query.cursor } },
      ];
    }
    const notifications = await this.prisma.orderNotification.findMany({
      where,
      select: {
        id: true,
        orderId: true,
        event: true,
        readAt: true,
        createdAt: true,
        order: { select: { customerId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = notifications.slice(0, limit);
    return {
      success: true,
      data: page.map(({ order, ...notification }) => ({
        ...notification,
        recipientRole: order.customerId === userId ? 'CUSTOMER' : 'PROVIDER',
        nextAction:
          order.customerId === userId &&
          ['ORDER_REJECTED', 'ORDER_EXPIRED'].includes(notification.event)
            ? 'REMATCH'
            : null,
      })),
      meta: {
        nextCursor: notifications.length > limit ? page.at(-1)?.id : null,
      },
    };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.orderNotification.updateMany({
      where: { id, ...orderNotificationScope(userId), readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.prisma.orderNotification.findFirst({
        where: { id, ...orderNotificationScope(userId) },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Không tìm thấy thông báo.');
    }
    return { success: true, data: null };
  }

  async changesSince(userId: string, after?: string) {
    const cursor = after
      ? await this.prisma.orderNotification.findFirst({
          where: { id: after, ...orderNotificationScope(userId) },
          select: { createdAt: true },
        })
      : null;
    if (after && !cursor)
      throw new BadRequestException('Thông báo tiếp nối không hợp lệ.');
    const rows = await this.prisma.orderNotification.findMany({
      where: {
        ...orderNotificationScope(userId),
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: after } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        orderId: true,
        event: true,
        createdAt: true,
        order: { select: { customerId: true } },
      },
      orderBy: after
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return (after ? rows : rows.reverse()).map(({ order, ...row }) => ({
      ...row,
      recipientRole: order.customerId === userId ? 'CUSTOMER' : 'PROVIDER',
      nextAction:
        order.customerId === userId &&
        ['ORDER_REJECTED', 'ORDER_EXPIRED'].includes(row.event)
          ? 'REMATCH'
          : null,
    }));
  }
}
