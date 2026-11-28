import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { ensureChatConversation, lockChat } from './chat.helpers';

export interface AttachOrderChatOptions {
  providerUserId?: string;
  assignedMemberId?: string | null;
  assignedMemberUserId?: string | null;
  assignedMemberVersion?: number | null;
  isNewOrder?: boolean;
}

@Injectable()
export class OrderChatService {
  constructor(private readonly audit: AuditService) {}

  async attach(
    tx: Prisma.TransactionClient,
    order: { id: string; customerId: string; providerId: string },
    options?: AttachOrderChatOptions,
  ) {
    const snapshot =
      options && options.assignedMemberId !== undefined
        ? {
            id: order.id,
            assignedMemberId: options.assignedMemberId,
            assignedMemberUserId: options.assignedMemberUserId ?? null,
            assignedMemberVersion: options.assignedMemberVersion ?? null,
          }
        : await tx.serviceOrder.findUniqueOrThrow({
            where: { id: order.id },
            select: {
              id: true,
              assignedMemberId: true,
              assignedMemberUserId: true,
              assignedMemberVersion: true,
            },
          });
    const ownerUserId =
      options?.providerUserId ??
      (
        await tx.providerProfile.findUniqueOrThrow({
          where: { id: order.providerId },
          select: { userId: true },
        })
      ).userId;
    const { conversation, created } = await ensureChatConversation(
      tx,
      order.customerId,
      order.providerId,
      ownerUserId,
      snapshot.assignedMemberId ? snapshot : undefined,
    );
    await lockChat(tx, conversation.id);
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { conversationId: conversation.id },
    });
    const eventKey = `order:${order.id}:${snapshot.assignedMemberId ? 'member-chat' : 'created'}`;
    const alreadyExists = options?.isNewOrder
      ? false
      : Boolean(
          await tx.chatMessage.findUnique({
            where: { eventKey },
            select: { id: true },
          }),
        );
    if (!alreadyExists) {
      const lastSeq = created
        ? 0
        : (
            await tx.chatConversation.findUniqueOrThrow({
              where: { id: conversation.id },
              select: { lastSequence: true },
            })
          ).lastSequence;
      const sequence = lastSeq + 1;
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
