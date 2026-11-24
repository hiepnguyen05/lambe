import { ChatMessageKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { MediaStorage } from '../../upload/application/media-storage.port';
import { ChatQueryService } from './chat-query.service';

describe('ChatQueryService message paging', () => {
  it('fetches messages after a sequence in ascending order with a bounded page', async () => {
    const db = {
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'chat-id',
          customerId: 'customer',
          provider: { userId: 'owner' },
        }),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'message-6',
            conversationId: 'chat-id',
            sequence: 6,
            kind: ChatMessageKind.TEXT,
            text: 'Tin 6',
            attachments: [],
            createdAt: new Date(),
          },
          {
            id: 'message-7',
            conversationId: 'chat-id',
            sequence: 7,
            kind: ChatMessageKind.TEXT,
            text: 'Tin 7',
            attachments: [],
            createdAt: new Date(),
          },
        ]),
      },
    };
    const service = new ChatQueryService(
      db as unknown as PrismaService,
      { createPrivateDownloadUrl: jest.fn() } as unknown as MediaStorage,
    );
    const result = await service.messages('customer', 'chat-id', {
      afterSequence: 5,
      limit: 100,
    });

    expect(db.chatConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'chat-id',
          OR: [
            { customerId: 'customer' },
            { provider: { userId: 'customer' } },
            { bookingOrder: { assignedMemberUserId: 'customer' } },
          ],
        },
      }),
    );
    expect(db.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'chat-id', sequence: { gt: 5 } },
        orderBy: { sequence: 'asc' },
        take: 101,
      }),
    );
    expect(result.data.map((message) => message.sequence)).toEqual([6, 7]);
    expect(result.meta.nextCursor).toBeNull();
  });
});
