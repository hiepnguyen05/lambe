import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { AiFeedbackDto } from '../dto/ai-consultation.dto';

@Injectable()
export class AiFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    dto: AiFeedbackDto,
  ) {
    const message = await this.prisma.aiMessage.findFirst({
      where: {
        conversationId,
        clientMessageId,
        role: 'user',
        conversation: { userId },
      },
      select: { id: true, result: true },
    });
    if (!message) throw new NotFoundException('Không tìm thấy tin nhắn.');
    if (!message.result)
      throw new ConflictException('Tin nhắn chưa có kết quả.');
    const data = await this.prisma.aiMessageFeedback.upsert({
      where: { messageId: message.id },
      create: {
        messageId: message.id,
        helpful: dto.helpful,
        reason: dto.reason,
      },
      update: { helpful: dto.helpful, reason: dto.reason ?? null },
      select: { helpful: true, reason: true, updatedAt: true },
    });
    return { success: true, data };
  }
}
