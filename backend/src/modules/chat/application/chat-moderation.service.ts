import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { ReportChatDto } from '../dto/chat.dto';
import { findAccessibleChat, lockAccessibleChat } from './chat.helpers';

@Injectable()
export class ChatModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async block(userId: string, id: string, blocked: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await lockAccessibleChat(tx, id, userId);
      const state = await tx.chatParticipantState.update({
        where: { conversationId_userId: { conversationId: id, userId } },
        data: { blockedAt: blocked ? new Date() : null },
      });
      return { blockedByMe: !!state.blockedAt };
    });
  }

  async report(userId: string, id: string, dto: ReportChatDto) {
    await findAccessibleChat(this.prisma, id, userId);
    if (dto.messageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: dto.messageId, conversationId: id },
        select: { id: true },
      });
      if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
    }
    return this.prisma.chatReport.create({
      data: {
        conversationId: id,
        reporterUserId: userId,
        messageId: dto.messageId,
        reason: dto.reason,
        detail: dto.detail,
      },
      select: { id: true, createdAt: true },
    });
  }
}
