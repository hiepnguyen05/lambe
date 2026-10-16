import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpStatus,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ChatMessageKind,
  Prisma,
  ProviderProfileStatus,
  ProviderServiceStatus,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { SendChatMessageDto, StartChatDto } from '../dto/chat.dto';
import {
  findAccessibleChat,
  lockChat,
  presentChatMessage,
} from './chat.helpers';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async start(customerId: string, dto: StartChatDto) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: dto.providerId,
        status: ProviderProfileStatus.ACTIVE,
        user: { status: 'ACTIVE' },
      },
      select: { id: true, userId: true },
    });
    if (!provider || provider.userId === customerId)
      throw new NotFoundException('Không tìm thấy nhà cung cấp phù hợp.');
    const customerRole = await this.prisma.userRoleAssignment.findFirst({
      where: { userId: customerId, role: 'CUSTOMER' },
      select: { id: true },
    });
    if (!customerRole)
      throw new ForbiddenException('Tài khoản không có quyền khách hàng.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`chat-start:${customerId}`}, 0))::text AS locked`,
      );
      const existing = await tx.chatConversation.findUnique({
        where: {
          customerId_providerId: { customerId, providerId: provider.id },
        },
        select: { id: true },
      });
      if (!existing) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await tx.chatConversation.count({
          where: { customerId, createdAt: { gte: since } },
        });
        if (recent >= 10)
          throw new HttpException(
            'Đã mở quá nhiều cuộc trò chuyện mới.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
      }
      const { conversation, created } = await this.ensureConversation(
        tx,
        customerId,
        provider.id,
        provider.userId,
      );
      await lockChat(tx, conversation.id);
      await this.assertProviderActive(tx, provider.id);
      await this.assertUnblocked(tx, conversation.id);
      const message = await this.appendUserMessage(
        tx,
        conversation.id,
        customerId,
        {
          clientMessageId: dto.clientMessageId,
          kind: ChatMessageKind.TEXT,
          text: dto.text,
        },
      );
      return {
        conversationId: conversation.id,
        created,
        message: presentChatMessage(message),
      };
    });
  }

  async send(userId: string, conversationId: string, dto: SendChatMessageDto) {
    const payload = this.validateMessage(dto);
    return this.prisma.$transaction(async (tx) => {
      await findAccessibleChat(tx, conversationId, userId);
      await lockChat(tx, conversationId);
      const conversation = await findAccessibleChat(tx, conversationId, userId);
      await this.assertProviderActive(tx, conversation.providerId);
      await this.assertUnblocked(tx, conversationId);
      if (userId === conversation.provider.userId) {
        if (conversation.lastSequence === 0)
          throw new ForbiddenException('Khách chưa bắt đầu cuộc trò chuyện.');
      }
      const message = await this.appendUserMessage(
        tx,
        conversationId,
        userId,
        payload,
      );
      return { conversationId, message: presentChatMessage(message) };
    });
  }

  async attachOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      customerId: string;
      providerId: string;
    },
  ): Promise<string> {
    const provider = await tx.providerProfile.findUniqueOrThrow({
      where: { id: order.providerId },
      select: { userId: true },
    });
    const { conversation } = await this.ensureConversation(
      tx,
      order.customerId,
      order.providerId,
      provider.userId,
    );
    await lockChat(tx, conversation.id);
    await tx.serviceOrder.update({
      where: { id: order.id },
      data: { conversationId: conversation.id },
    });
    const eventKey = `order:${order.id}:created`;
    const exists = await tx.chatMessage.findUnique({
      where: { eventKey },
      select: { id: true },
    });
    if (!exists) {
      const fresh = await tx.chatConversation.findUniqueOrThrow({
        where: { id: conversation.id },
        select: { lastSequence: true },
      });
      const seq = fresh.lastSequence + 1;
      await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          sequence: seq,
          kind: ChatMessageKind.ORDER_EVENT,
          orderId: order.id,
          eventKey,
          payload: { event: 'ORDER_REQUESTED' },
        },
      });
      await tx.chatConversation.update({
        where: { id: conversation.id },
        data: { lastSequence: seq, lastMessageAt: new Date() },
      });
      await tx.chatParticipantState.update({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: order.customerId,
          },
        },
        data: { lastReadSequence: seq },
      });
    }
    return conversation.id;
  }

  private async assertProviderActive(tx: Prisma.TransactionClient, id: string) {
    const active = await tx.providerProfile.findFirst({
      where: {
        id,
        status: ProviderProfileStatus.ACTIVE,
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (!active) throw new ForbiddenException('Hồ sơ thợ không còn hoạt động.');
  }

  private async ensureConversation(
    tx: Prisma.TransactionClient,
    customerId: string,
    providerId: string,
    providerUserId: string,
  ) {
    const inserted = await tx.chatConversation.createMany({
      data: [{ customerId, providerId }],
      skipDuplicates: true,
    });
    const conversation = await tx.chatConversation.findUniqueOrThrow({
      where: { customerId_providerId: { customerId, providerId } },
    });
    await tx.chatParticipantState.createMany({
      data: [
        { conversationId: conversation.id, userId: customerId },
        { conversationId: conversation.id, userId: providerUserId },
      ],
      skipDuplicates: true,
    });
    return { conversation, created: inserted.count === 1 };
  }

  private async assertUnblocked(tx: Prisma.TransactionClient, id: string) {
    const blocked = await tx.chatParticipantState.findFirst({
      where: { conversationId: id, blockedAt: { not: null } },
      select: { userId: true },
    });
    if (blocked) throw new ConflictException('Hội thoại đã bị chặn.');
  }

  private validateMessage(dto: SendChatMessageDto) {
    if (dto.kind === ChatMessageKind.TEXT && dto.text && !dto.providerServiceId)
      return dto;
    if (
      dto.kind === ChatMessageKind.SERVICE_CARD &&
      dto.providerServiceId &&
      !dto.text
    )
      return dto;
    throw new BadRequestException('Nội dung tin nhắn không hợp lệ.');
  }

  private async appendUserMessage(
    tx: Prisma.TransactionClient,
    conversationId: string,
    userId: string,
    dto: SendChatMessageDto,
  ) {
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          dto.kind,
          dto.text ?? null,
          dto.providerServiceId ?? null,
        ]),
      )
      .digest('hex');
    const previous = await tx.chatMessage.findUnique({
      where: {
        conversationId_senderUserId_clientMessageId: {
          conversationId,
          senderUserId: userId,
          clientMessageId: dto.clientMessageId,
        },
      },
    });
    if (previous) {
      if (previous.requestHash !== hash)
        throw new ConflictException(
          'clientMessageId đã dùng với nội dung khác.',
        );
      return previous;
    }
    let payload: Prisma.InputJsonValue | undefined;
    if (dto.kind === ChatMessageKind.SERVICE_CARD) {
      const service = await tx.providerService.findFirst({
        where: {
          id: dto.providerServiceId,
          providerId: (
            await tx.chatConversation.findUniqueOrThrow({
              where: { id: conversationId },
              select: { providerId: true },
            })
          ).providerId,
          status: ProviderServiceStatus.ACTIVE,
          service: {
            status: ServiceStatus.ACTIVE,
            category: { status: ServiceCategoryStatus.ACTIVE },
          },
        },
        select: {
          priceAmount: true,
          durationMinutes: true,
          service: { select: { name: true, currencyCode: true } },
        },
      });
      if (!service) throw new ConflictException('Dịch vụ không còn khả dụng.');
      payload = {
        serviceName: service.service.name,
        priceAmount: service.priceAmount,
        currencyCode: service.service.currencyCode,
        durationMinutes: service.durationMinutes,
      };
    }
    const current = await tx.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { lastSequence: true },
    });
    const seq = current.lastSequence + 1;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        sequence: seq,
        senderUserId: userId,
        kind: dto.kind,
        text: dto.text,
        providerServiceId: dto.providerServiceId,
        clientMessageId: dto.clientMessageId,
        requestHash: hash,
        payload,
      },
    });
    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { lastSequence: seq, lastMessageAt: message.createdAt },
    });
    await tx.chatParticipantState.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadSequence: seq },
    });
    return message;
  }
}
