import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ChatMessagesQueryDto, InboxQueryDto } from '../dto/chat.dto';
import { findAccessibleChat, presentChatMessage } from './chat.helpers';

@Injectable()
export class ChatQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async inbox(userId: string, query: InboxQueryDto) {
    const limit = query.limit ?? 20;
    const side: Prisma.ChatConversationWhereInput =
      query.view === 'customer'
        ? { customerId: userId }
        : { provider: { userId } };
    let boundary: { lastMessageAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64url').toString('utf8'),
        ) as { id: unknown; at: unknown };
        if (
          typeof decoded.id !== 'string' ||
          typeof decoded.at !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(decoded.id)
        )
          throw new Error('invalid cursor');
        const date = new Date(decoded.at);
        if (!Number.isFinite(date.getTime())) throw new Error('invalid cursor');
        boundary = { id: decoded.id, lastMessageAt: date };
      } catch {
        throw new BadRequestException('Cursor không hợp lệ.');
      }
    }
    const rows = await this.prisma.chatConversation.findMany({
      where: {
        ...side,
        ...(boundary && {
          OR: [
            { lastMessageAt: { lt: boundary.lastMessageAt } },
            { lastMessageAt: boundary.lastMessageAt, id: { lt: boundary.id } },
          ],
        }),
      },
      include: {
        customer: { select: { id: true, fullName: true, avatarUrl: true } },
        provider: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        participants: {
          where: { userId },
          select: { lastReadSequence: true, blockedAt: true },
        },
        messages: { orderBy: { sequence: 'desc' }, take: 1 },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      data: page.map((row) => ({
        id: row.id,
        providerId: row.providerId,
        peer: query.view === 'customer' ? row.provider : row.customer,
        lastMessage: row.messages[0]
          ? presentChatMessage(row.messages[0])
          : null,
        lastMessageAt: row.lastMessageAt,
        unreadCount: Math.max(
          0,
          row.lastSequence - (row.participants[0]?.lastReadSequence ?? 0),
        ),
        blockedByMe: !!row.participants[0]?.blockedAt,
      })),
      meta: {
        nextCursor: hasMore
          ? Buffer.from(
              JSON.stringify({
                id: page[page.length - 1].id,
                at: page[page.length - 1].lastMessageAt.toISOString(),
              }),
            ).toString('base64url')
          : null,
      },
    };
  }

  async messages(userId: string, id: string, query: ChatMessagesQueryDto) {
    if (query.beforeSequence !== undefined && query.afterSequence !== undefined)
      throw new BadRequestException('Chỉ chọn một hướng phân trang.');
    const conversation = await findAccessibleChat(this.prisma, id, userId);
    const ascending = query.afterSequence !== undefined;
    const limit = query.limit ?? 50;
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(query.beforeSequence !== undefined && {
          sequence: { lt: query.beforeSequence },
        }),
        ...(query.afterSequence !== undefined && {
          sequence: { gt: query.afterSequence },
        }),
      },
      orderBy: { sequence: ascending ? 'asc' : 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      data: page.map(presentChatMessage),
      meta: { nextCursor: hasMore ? page[page.length - 1].sequence : null },
    };
  }

  async markRead(userId: string, id: string, sequence: number) {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await findAccessibleChat(tx, id, userId);
      if (sequence > conversation.lastSequence)
        throw new BadRequestException('Tin nhắn chưa tồn tại.');
      await tx.chatParticipantState.updateMany({
        where: {
          conversationId: id,
          userId,
          lastReadSequence: { lt: sequence },
        },
        data: { lastReadSequence: sequence },
      });
      return tx.chatParticipantState.findUniqueOrThrow({
        where: { conversationId_userId: { conversationId: id, userId } },
        select: { lastReadSequence: true },
      });
    });
  }
}
