import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessageKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { PushOutboxService } from '../../push/application/push-outbox.service';
import { ChatService } from './chat.service';
import { OrderChatService } from './order-chat.service';

describe('ChatService access and idempotency', () => {
  const customerId = 'customer';
  const providerId = 'provider';
  const providerUserId = 'provider-user';
  const conversationId = 'conversation';
  const clientMessageId = 'e9317119-1bf8-494d-a8da-5745075731ac';
  const dto = {
    kind: ChatMessageKind.TEXT,
    text: 'Xin chào',
    clientMessageId,
  };

  function setup() {
    const conversation = {
      id: conversationId,
      customerId,
      providerId,
      lastSequence: 1,
      provider: { userId: providerUserId, status: 'ACTIVE' },
    };
    const tx = {
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue(conversation),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          lastSequence: 1,
          customerId,
          provider: { userId: providerUserId },
        }),
        update: jest.fn(),
      },
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: providerId }),
      },
      chatParticipantState: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      chatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            id: 'message',
            orderId: null,
            payload: null,
            createdAt: new Date(),
          }),
        ),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const db = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        ),
    };
    const push = { enqueue: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new ChatService(
        db as unknown as PrismaService,
        {
          publishChatUpdate: jest.fn().mockResolvedValue(undefined),
        } as unknown as RedisCacheService,
        push as unknown as PushOutboxService,
        {} as OrderChatService,
      ),
      push,
      tx,
      conversation,
    };
  }

  it('does not expose another pair conversation to an outsider', async () => {
    const { service, tx } = setup();
    tx.chatConversation.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.send('outsider', conversationId, dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
  });

  it('prevents the provider from sending before a customer message or order', async () => {
    const { service, tx, conversation } = setup();
    tx.chatConversation.findFirst.mockResolvedValue({
      ...conversation,
      lastSequence: 0,
    });
    await expect(
      service.send(providerUserId, conversationId, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
  });

  it('blocks both sides from sending after a participant blocks the chat', async () => {
    const { service, tx } = setup();
    tx.chatParticipantState.findFirst.mockResolvedValue({
      userId: providerUserId,
    });
    await expect(
      service.send(customerId, conversationId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
  });

  it('returns the same message for an identical retry', async () => {
    const { service, tx, push } = setup();
    const first = await service.send(customerId, conversationId, dto);
    expect(push.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: providerUserId,
        entityType: 'CHAT',
        entityId: conversationId,
      }),
    );
    const calls = tx.chatMessage.create.mock.calls as unknown as Array<
      [{ data: { requestHash: string } }]
    >;
    const hash = calls[0][0].data.requestHash;
    tx.chatMessage.findUnique.mockResolvedValue({
      id: 'message',
      sequence: 2,
      senderUserId: customerId,
      kind: ChatMessageKind.TEXT,
      text: dto.text,
      providerServiceId: null,
      orderId: null,
      payload: null,
      requestHash: hash,
      createdAt: new Date(),
    });
    const again = await service.send(customerId, conversationId, dto);
    expect(first.message.id).toBe(again.message.id);
    expect(tx.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(tx.chatConversation.update).toHaveBeenCalledTimes(1);
    expect(push.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects reusing a message ID with different content', async () => {
    const { service, tx } = setup();
    tx.chatMessage.findUnique.mockResolvedValue({ requestHash: 'different' });
    await expect(
      service.send(customerId, conversationId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
  });

  it('rejects client attempts to forge an order event', async () => {
    const { service, tx } = setup();
    await expect(
      service.send(customerId, conversationId, {
        ...dto,
        kind: ChatMessageKind.ORDER_EVENT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.chatMessage.create).not.toHaveBeenCalled();
  });
});
