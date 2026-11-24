import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ProviderNotificationQueryDto } from '../dto/provider-notification-query.dto';

const noticeSelect = {
  id: true,
  providerId: true,
  event: true,
  memberId: true,
  membershipVersion: true,
  readAt: true,
  resolvedAt: true,
  createdAt: true,
} satisfies Prisma.ProviderOperationalNotificationSelect;
type Notice = Prisma.ProviderOperationalNotificationGetPayload<{
  select: typeof noticeSelect;
}>;

@Injectable()
export class ProviderNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(userId: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { userId, user: { status: 'ACTIVE' } },
      select: { id: true },
    });
    if (!provider)
      throw new ForbiddenException(
        'Chỉ chủ hồ sơ đối tác được xem thông báo vận hành.',
      );
    return { userId, providerId: provider.id };
  }

  async list(userId: string, query: ProviderNotificationQueryDto) {
    const scope = await this.scope(userId),
      limit = query.limit ?? 20;
    const anchor = query.cursor
      ? await this.prisma.providerOperationalNotification.findFirst({
          where: { ...scope, id: query.cursor },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.cursor && !anchor)
      throw new BadRequestException('Cursor thông báo không hợp lệ.');
    const [rows, unreadCount] = await this.prisma.$transaction(
      [
        this.prisma.providerOperationalNotification.findMany({
          where: {
            ...scope,
            ...(anchor && {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { lt: anchor.id } },
              ],
            }),
          },
          select: noticeSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        }),
        this.prisma.providerOperationalNotification.count({
          where: { ...scope, readAt: null },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      success: true,
      data: rows.slice(0, limit).map((row) => this.present(row)),
      meta: {
        unreadCount,
        nextCursor: rows.length > limit ? rows[limit - 1].id : null,
      },
    };
  }

  async detail(userId: string, id: string) {
    const scope = await this.scope(userId);
    const row = await this.prisma.providerOperationalNotification.findFirst({
      where: { ...scope, id },
      select: noticeSelect,
    });
    if (!row) throw new NotFoundException('Không tìm thấy thông báo vận hành.');
    return { success: true, data: this.present(row) };
  }

  async markRead(userId: string, id: string) {
    const scope = await this.scope(userId);
    await this.prisma.providerOperationalNotification.updateMany({
      where: { ...scope, id, readAt: null },
      data: { readAt: new Date() },
    });
    return this.detail(userId, id);
  }

  async changesSince(userId: string, after?: string) {
    const scope = await this.scope(userId);
    const anchor = after
      ? await this.prisma.providerOperationalNotification.findFirst({
          where: { ...scope, id: after },
          select: { id: true, streamSequence: true },
        })
      : null;
    if (after && (!anchor || anchor.streamSequence === null))
      throw new BadRequestException('Cursor tiếp nối không hợp lệ.');
    const rows = await this.prisma.providerOperationalNotification.findMany({
      where: {
        ...scope,
        streamSequence: anchor?.streamSequence
          ? { gt: anchor.streamSequence }
          : { not: null },
      },
      select: noticeSelect,
      orderBy: anchor
        ? [{ streamSequence: 'asc' }]
        : [{ streamSequence: 'desc' }],
      take: 50,
    });
    return (anchor ? rows : rows.reverse()).map((row) => this.present(row));
  }

  private present(row: Notice) {
    return {
      ...row,
      recipientRole: 'PROVIDER_OWNER',
      entityType: 'PROVIDER_NOTIFICATION',
      deepLink:
        row.event === 'WALLET_LOW_BALANCE'
          ? '/provider/wallet'
          : row.memberId
            ? `/provider/members/${row.memberId}`
            : '/provider/account',
    };
  }
}
