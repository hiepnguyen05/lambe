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
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { PushOutboxService } from '../../push/application/push-outbox.service';
import type { SendChatMessageDto, StartChatDto } from '../dto/chat.dto';
import {
  findAccessibleChat,
  lockChat,
  lockAccessibleChat,
  assertChatOpen,
  chatRecipients,
  ensureChatConversation,
  presentChatMessage,
} from './chat.helpers';
import {
  OrderChatService,
  type AttachOrderChatOptions,
} from './order-chat.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly push: PushOutboxService,
    private readonly orderChats: OrderChatService,
  ) {}

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
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`chat-start:${customerId}`}, 0))::text AS locked`,
      );
      const existing = await tx.chatConversation.findUnique({
        where: {
          customerId_providerId_scopeKey: {
            customerId,
            providerId: provider.id,
            scopeKey: 'CONSULTATION',
          },
        },
        select: { id: true },
      });
      if (!existing) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await tx.chatConversation.count({
          where: {
            customerId,
            bookingOrderId: null,
            createdAt: { gte: since },
          },
        });
        if (recent >= 10)
          throw new HttpException(
            'Đã mở quá nhiều cuộc trò chuyện mới.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
      }
      const { conversation, created } = await ensureChatConversation(
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
    void this.cache.publishChatUpdate(result.conversationId);
    return result;
  }

  async send(userId: string, conversationId: string, dto: SendChatMessageDto) {
    const payload = this.validateMessage(dto);
    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await lockAccessibleChat(tx, conversationId, userId);
      assertChatOpen(conversation);
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
    void this.cache.publishChatUpdate(conversationId);
    return result;
  }

  notifyOrderAttached(conversationId: string): void {
    void this.cache.publishChatUpdate(conversationId);
  }

  async attachOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      customerId: string;
      providerId: string;
    },
    options?: AttachOrderChatOptions,
  ): Promise<string> {
    return this.orderChats.attach(tx, order, options);
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
    const current = await findAccessibleChat(tx, conversationId, userId);
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
    for (const recipient of chatRecipients(current, userId))
      await this.push.enqueue(tx, {
        ...recipient,
        sourceId: message.id,
        event: 'CHAT_MESSAGE',
        entityType: 'CHAT',
        entityId: conversationId,
      });
    return message;
  }
}
