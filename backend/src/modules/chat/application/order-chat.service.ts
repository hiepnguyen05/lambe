import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { ensureChatConversation, lockChat } from './chat.helpers';

@Injectable()
export class OrderChatService {
  constructor(private readonly audit: AuditService) {}

  async attach(
    tx: Prisma.TransactionClient,
    order: { id: string; customerId: string; providerId: string },
  ) {
    const snapshot = await tx.serviceOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        id: true,
        assignedMemberId: true,
        assignedMemberUserId: true,
        assignedMemberVersion: true,
      },
    });
    const provider = await tx.providerProfile.findUniqueOrThrow({
      where: { id: order.providerId },
      select: { userId: true },
    });
    const { conversation, created } = await ensureChatConversation(
      tx,
      order.customerId,
      order.providerId,
      provider.userId,
      snapshot.assignedMemberId ? snapshot : undefined,
    );
    await lockChat(tx, conversation.id);
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { conversationId: conversation.id },
    });
    const eventKey = `order:${order.id}:${snapshot.assignedMemberId ? 'member-chat' : 'created'}`;
    if (
      !(await tx.chatMessage.findUnique({
        where: { eventKey },
        select: { id: true },
      }))
    ) {
      const fresh = await tx.chatConversation.findUniqueOrThrow({
        where: { id: conversation.id },
        select: { lastSequence: true },
      });
      const sequence = fresh.lastSequence + 1;
      await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          sequence,
          kind: 'ORDER_EVENT',
          orderId: order.id,
          eventKey,
          payload: { event: 'ORDER_REQUESTED' },
        },
      });
      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: { lastSequence: sequence, lastMessageAt: new Date() },
      });
      await tx.chatParticipantState.update({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: order.customerId,
          },
        },
        data: { lastReadSequence: sequence },
      });
    }
    if (created && snapshot.assignedMemberId)
      await this.audit.record(
        {
          actorUserId: order.customerId,
          action: 'ORDER_CHAT_MEMBER_GRANTED',
          resourceType: 'ChatConversation',
          resourceId: conversation.id,
          result: 'SUCCESS',
          metadata: {
            orderId: order.id,
            memberId: snapshot.assignedMemberId,
            membershipVersion: snapshot.assignedMemberVersion,
          },
        },
        {},
        tx,
      );
    return conversation.id;
  }
}
