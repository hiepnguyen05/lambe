import { NotFoundException } from '@nestjs/common';
import { ChatMessage, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export async function findAccessibleChat(db: Db, id: string, userId: string) {
  const conversation = await db.chatConversation.findFirst({
    where: { id, OR: [{ customerId: userId }, { provider: { userId } }] },
    include: { provider: { select: { userId: true, status: true } } },
  });
  if (!conversation) throw new NotFoundException('Không tìm thấy hội thoại.');
  return conversation;
}

export async function lockChat(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "chat_conversations" WHERE "id" = ${id} FOR UPDATE`,
  );
}

export function presentChatMessage(message: ChatMessage) {
  return {
    id: message.id,
    sequence: message.sequence,
    senderUserId: message.senderUserId,
    kind: message.kind,
    text: message.text,
    providerServiceId: message.providerServiceId,
    orderId: message.orderId,
    payload: message.payload,
    createdAt: message.createdAt,
  };
}
