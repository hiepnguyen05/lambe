import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { AiConsultationResult } from './ai-consultation.service';

const PROCESSING_LEASE_MS = 5 * 60_000;

export interface AiProcessingClaim {
  kind: 'processing';
  token: string;
  messageId: string;
  day: Date;
}

@Injectable()
export class AiMessageProcessingService {
  constructor(private readonly prisma: PrismaService) {}

  claim(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    text: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ai:${userId}`}, 0))::text AS locked`,
      );
      const existing = await transaction.aiMessage.findUnique({
        where: {
          conversationId_clientMessageId: { conversationId, clientMessageId },
        },
        select: {
          id: true,
          text: true,
          result: true,
          processingToken: true,
          processingStartedAt: true,
        },
      });
      if (existing?.text !== undefined && existing.text !== text)
        throw new ConflictException(
          'clientMessageId đã dùng cho nội dung khác.',
        );
      if (existing?.result)
        return { kind: 'replay' as const, result: existing.result };

      const now = new Date();
      const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
      if (
        existing?.processingToken &&
        existing.processingStartedAt &&
        existing.processingStartedAt > staleBefore
      )
        throw new ConflictException(
          'Tin nhắn đang được xử lý. Vui lòng thử lại.',
        );

      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      const completedCount = await transaction.aiUsageEntry.count({
        where: { userId, day: today },
      });
      const processingCount = await transaction.aiMessage.count({
        where: {
          conversation: { userId },
          role: 'user',
          processingToken: { not: null },
          processingStartedAt: { gte: today, gt: staleBefore },
        },
      });
      if (completedCount + processingCount >= 50)
        throw new HttpException(
          'Bạn đã dùng hết lượt tư vấn hôm nay.',
          HttpStatus.TOO_MANY_REQUESTS,
        );

      const token = randomUUID();
      let messageId: string;
      if (existing) {
        await transaction.aiMessage.update({
          where: {
            conversationId_clientMessageId: { conversationId, clientMessageId },
          },
          data: { processingToken: token, processingStartedAt: now },
        });
        messageId = existing.id;
      } else {
        const created = await transaction.aiMessage.create({
          data: {
            conversationId,
            clientMessageId,
            role: 'user',
            text,
            processingToken: token,
            processingStartedAt: now,
          },
          select: { id: true },
        });
        messageId = created.id;
      }
      return { kind: 'processing' as const, token, messageId, day: today };
    });
  }

  async complete(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    claim: AiProcessingClaim,
    result: AiConsultationResult,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ai:${userId}`}, 0))::text AS locked`,
      );
      const updated = await transaction.aiMessage.updateMany({
        where: {
          conversationId,
          clientMessageId,
          processingToken: claim.token,
          processingStartedAt: {
            gt: new Date(Date.now() - PROCESSING_LEASE_MS),
          },
        },
        data: {
          result: result as unknown as Prisma.InputJsonValue,
          processingToken: null,
          processingStartedAt: null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Tin nhắn đã được xử lý bởi yêu cầu khác.');
      await transaction.aiUsageEntry.create({
        data: { messageId: claim.messageId, userId, day: claim.day },
      });
      await transaction.aiMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          text: result.reply,
          result: result as unknown as Prisma.InputJsonValue,
        },
      });
      await transaction.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    });
  }

  async release(
    conversationId: string,
    clientMessageId: string,
    token: string,
  ): Promise<void> {
    await this.prisma.aiMessage.updateMany({
      where: { conversationId, clientMessageId, processingToken: token },
      data: { processingToken: null, processingStartedAt: null },
    });
  }
}
