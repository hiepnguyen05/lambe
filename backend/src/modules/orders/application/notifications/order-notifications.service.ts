import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class OrderNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const notifications = await this.prisma.orderNotification.findMany({
      where: { userId },
      select: {
        id: true,
        orderId: true,
        event: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { success: true, data: notifications };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.orderNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.prisma.orderNotification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Không tìm thấy thông báo.');
    }
    return { success: true, data: null };
  }
}
