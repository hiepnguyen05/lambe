import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChatAttachment, ChatMessage, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { MediaStorage } from '../../upload/application/media-storage.port';

type Db = PrismaService | Prisma.TransactionClient;

export const chatContextInclude = {
  customer: { select: { fullName: true, avatarUrl: true } },
  provider: {
    select: {
      userId: true,
      providerType: true,
      status: true,
      displayName: true,
      avatarUrl: true,
      user: { select: { status: true } },
    },
  },
  bookingOrder: {
    select: {
      id: true,
      status: true,
      assignedMemberId: true,
      assignedMemberVersion: true,
      assignedMemberUserId: true,
      assignedMemberName: true,
      assignedMemberAvatarUrl: true,
      assignedMember: {
        select: {
          id: true,
          userId: true,
          membershipVersion: true,
          status: true,
          canProvideServices: true,
          user: { select: { status: true } },
        },
      },
    },
  },
} satisfies Prisma.ChatConversationInclude;
export type AccessibleChat = Prisma.ChatConversationGetPayload<{
  include: typeof chatContextInclude;
}>;

export function activeChatWorker(conversation: AccessibleChat) {
  const order = conversation.bookingOrder,
    member = order?.assignedMember;
  return !!(
    order &&
    member &&
    member.id === order.assignedMemberId &&
    member.userId === order.assignedMemberUserId &&
    member.membershipVersion === order.assignedMemberVersion &&
    member.status === 'ACTIVE' &&
    member.canProvideServices &&
    member.user.status === 'ACTIVE' &&
    conversation.provider.status === 'ACTIVE' &&
    conversation.provider.user.status === 'ACTIVE'
  );
}

export async function findAccessibleChat(db: Db, id: string, userId: string) {
  const conversation = await db.chatConversation.findFirst({
    where: {
      id,
      OR: [
        { customerId: userId },
        { provider: { userId } },
        { bookingOrder: { assignedMemberUserId: userId } },
      ],
    },
    include: chatContextInclude,
  });
  if (
    !conversation ||
    (conversation.customerId !== userId &&
      conversation.provider.userId !== userId &&
      !activeChatWorker(conversation))
  )
    throw new NotFoundException('Không tìm thấy hội thoại.');
  return conversation;
}

export async function lockAccessibleChat(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
) {
  const current = await findAccessibleChat(tx, id, userId);
  if (current.bookingOrder?.assignedMemberId) {
    // Fence lifecycle writers without serializing independent conversations in one organization.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_profiles" WHERE "id"=${current.providerId} FOR SHARE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT u."id" FROM "users" u JOIN "provider_members" m ON m."userId"=u."id" WHERE m."id"=${current.bookingOrder.assignedMemberId} FOR SHARE OF u`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_members" WHERE "id"=${current.bookingOrder.assignedMemberId} FOR SHARE`,
    );
  }
  await lockChat(tx, id);
  return findAccessibleChat(tx, id, userId);
}

export function assertChatOpen(conversation: AccessibleChat) {
  if (
    conversation.bookingOrder &&
    ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(
      conversation.bookingOrder.status,
    )
  )
    throw new ConflictException(
      'Đơn đã kết thúc không nhận thực hiện; hội thoại chỉ còn để đọc lịch sử.',
    );
}

export function chatRecipients(conversation: AccessibleChat, senderId: string) {
  const ids = new Set([conversation.customerId, conversation.provider.userId]);
  if (activeChatWorker(conversation))
    ids.add(conversation.bookingOrder!.assignedMemberUserId!);
  ids.delete(senderId);
  return [...ids].map((userId) => ({
    userId,
    recipientRole:
      userId === conversation.customerId
        ? ('CUSTOMER' as const)
        : ('PROVIDER' as const),
  }));
}

export function presentChatContext(conversation: AccessibleChat) {
  const o = conversation.bookingOrder;
  return {
    type: o ? 'ORDER' : 'CONSULTATION',
    orderId: o?.id ?? null,
    assignedMember: o
      ? {
          id: o.assignedMemberId,
          displayName: o.assignedMemberName,
          avatarUrl: o.assignedMemberAvatarUrl,
        }
      : null,
    workerCanChat: o ? activeChatWorker(conversation) : false,
    readOnly:
      (!!o && ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(o.status)) ||
      conversation.provider.status !== 'ACTIVE' ||
      conversation.provider.user.status !== 'ACTIVE',
  };
}

export function chatParticipants(conversation: AccessibleChat) {
  const o = conversation.bookingOrder;
  return [
    {
      userId: conversation.customerId,
      role: 'CUSTOMER',
      displayName: conversation.customer.fullName,
      avatarUrl: conversation.customer.avatarUrl,
    },
    {
      userId: conversation.provider.userId,
      role:
        conversation.provider.providerType === 'ORGANIZATION'
          ? 'ORGANIZATION'
          : 'PROVIDER',
      displayName: conversation.provider.displayName,
      avatarUrl: conversation.provider.avatarUrl,
    },
    ...(o?.assignedMemberUserId &&
    o.assignedMemberUserId !== conversation.provider.userId &&
    o.assignedMemberUserId !== conversation.customerId
      ? [
          {
            userId: o.assignedMemberUserId,
            role: 'MEMBER',
            displayName: o.assignedMemberName,
            avatarUrl: o.assignedMemberAvatarUrl,
          },
        ]
      : []),
  ];
}

export async function ensureChatConversation(
  tx: Prisma.TransactionClient,
  customerId: string,
  providerId: string,
  ownerId: string,
  order?: { id: string; assignedMemberUserId: string | null },
) {
  const scopeKey = order?.id ?? 'CONSULTATION';
  const inserted = await tx.chatConversation.createMany({
    data: [{ customerId, providerId, scopeKey, bookingOrderId: order?.id }],
    skipDuplicates: true,
  });
  const conversation = await tx.chatConversation.findUniqueOrThrow({
    where: {
      customerId_providerId_scopeKey: { customerId, providerId, scopeKey },
    },
  });
  const ids = new Set([customerId, ownerId]);
  if (order?.assignedMemberUserId) ids.add(order.assignedMemberUserId);
  await tx.chatParticipantState.createMany({
    data: [...ids].map((userId) => ({
      conversationId: conversation.id,
      userId,
    })),
    skipDuplicates: true,
  });
  return { conversation, created: inserted.count === 1 };
}

export async function lockChat(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "chat_conversations" WHERE "id" = ${id} FOR UPDATE`,
  );
}

type ChatMessageWithAttachments = ChatMessage & {
  attachments?: ChatAttachment[];
};

const mimeTypeOf = (format: string): string =>
  format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg'
    ? 'image/jpeg'
    : `image/${format.toLowerCase()}`;

export function presentChatMessage(
  message: ChatMessageWithAttachments,
  mediaStorage?: MediaStorage,
) {
  return {
    id: message.id,
    sequence: message.sequence,
    senderUserId: message.senderUserId,
    kind: message.kind,
    text: message.text,
    providerServiceId: message.providerServiceId,
    orderId: message.orderId,
    payload: message.payload,
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      url: mediaStorage?.createPrivateDownloadUrl(
        attachment.publicId,
        attachment.fileFormat,
      ),
      mimeType: mimeTypeOf(attachment.fileFormat),
      byteSize: attachment.byteSize,
      width: attachment.width,
      height: attachment.height,
      position: attachment.position,
    })),
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt,
  };
}
