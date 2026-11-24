import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChatMessageKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { PushOutboxService } from '../../push/application/push-outbox.service';
import type { MediaStorage } from '../../upload/application/media-storage.port';
import { ChatImageService } from './chat-image.service';

interface AttachmentCreateInput {
  publicId: string;
  fileFormat: string;
  deliveryType: string;
  byteSize: number;
  width: number;
  height: number;
  position: number;
}

interface MessageCreateArgs {
  data: {
    conversationId: string;
    sequence: number;
    senderUserId: string;
    kind: ChatMessageKind;
    clientMessageId: string;
    requestHash: string;
    attachments: { create: AttachmentCreateInput[] };
  };
}

interface StoredMessage extends Omit<MessageCreateArgs['data'], 'attachments'> {
  id: string;
  text: null;
  providerServiceId: null;
  orderId: null;
  eventKey: null;
  payload: null;
  createdAt: Date;
  attachments: Array<
    AttachmentCreateInput & {
      id: string;
      messageId: string;
      createdAt: Date;
    }
  >;
}

describe('ChatImageService', () => {
  const customerId = 'customer';
  const providerId = 'provider';
  const providerUserId = 'provider-user';
  const conversationId = 'conversation';
  const clientMessageId = 'e9317119-1bf8-494d-a8da-5745075731ac';

  const createFile = (): Express.Multer.File => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    return {
      buffer,
      size: buffer.length,
      mimetype: 'image/jpeg',
      fieldname: 'files',
      originalname: 'photo.jpg',
      encoding: '7bit',
    } as Express.Multer.File;
  };

  function setup() {
    const conversation = {
      id: conversationId,
      customerId,
      providerId,
      lastSequence: 1,
      provider: { userId: providerUserId, status: 'ACTIVE' },
    };
    let lastCreatedMessage: StoredMessage | undefined;
    const createMessage = jest.fn<Promise<StoredMessage>, [MessageCreateArgs]>(
      ({ data }) => {
        const attachments = data.attachments.create.map(
          (attachment, index) => ({
            ...attachment,
            id: `attachment-${index}`,
            messageId: 'message',
            createdAt: new Date(),
          }),
        );
        lastCreatedMessage = {
          ...data,
          id: 'message',
          text: null,
          providerServiceId: null,
          orderId: null,
          eventKey: null,
          payload: null,
          createdAt: new Date(),
          attachments,
        };
        return Promise.resolve(lastCreatedMessage);
      },
    );
    const findMessage = jest.fn<Promise<StoredMessage | null>, [unknown?]>();
    findMessage.mockResolvedValue(null);
    const tx = {
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue(conversation),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ lastSequence: 1 }),
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
        findUnique: findMessage,
        create: createMessage,
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const db = {
      chatConversation: tx.chatConversation,
      chatMessage: tx.chatMessage,
      $transaction: jest
        .fn()
        .mockImplementation(
          (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        ),
    };
    const mediaStorage = {
      uploadImage: jest.fn(),
      uploadPrivateImage: jest.fn(),
      uploadChatImage: jest.fn().mockResolvedValue({
        url: 'http://cloudinary.test/private.jpg',
        secureUrl: 'https://cloudinary.test/private.jpg',
        publicId: 'lambe/chat/conversation/image',
        format: 'jpg',
        width: 800,
        height: 600,
        resourceType: 'image',
        deliveryType: 'authenticated' as const,
      }),
      publishPrivateImage: jest.fn(),
      createPrivateDownloadUrl: jest
        .fn()
        .mockReturnValue('https://cloudinary.test/signed.jpg'),
      deleteImage: jest.fn().mockResolvedValue(true),
    } satisfies MediaStorage;
    return {
      service: new ChatImageService(
        db as unknown as PrismaService,
        mediaStorage,
        {
          publishChatUpdate: jest.fn().mockResolvedValue(undefined),
        } as unknown as RedisCacheService,
        {
          enqueue: jest.fn().mockResolvedValue(undefined),
        } as unknown as PushOutboxService,
      ),
      db,
      tx,
      mediaStorage,
      conversation,
      getLastCreatedMessage: () => {
        if (!lastCreatedMessage) throw new Error('No message was created.');
        return lastCreatedMessage;
      },
    };
  }

  it('uploads privately and stores an image message with attachments', async () => {
    const { service, tx, mediaStorage } = setup();
    const result = await service.send(
      customerId,
      conversationId,
      clientMessageId,
      [createFile()],
    );

    expect(mediaStorage.uploadChatImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      `lambe/chat/${conversationId}`,
    );
    expect(tx.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(tx.chatMessage.create.mock.calls[0][0].data.kind).toBe(
      ChatMessageKind.IMAGE,
    );
    expect(result.message.attachments).toEqual([
      expect.objectContaining({
        url: 'https://cloudinary.test/signed.jpg',
        mimeType: 'image/jpeg',
      }),
    ]);
  });

  it('returns an identical retry without uploading again', async () => {
    const { service, tx, mediaStorage, getLastCreatedMessage } = setup();
    const first = await service.send(
      customerId,
      conversationId,
      clientMessageId,
      [createFile()],
    );
    const created = getLastCreatedMessage();
    tx.chatMessage.findUnique.mockResolvedValue({
      ...created,
      requestHash: tx.chatMessage.create.mock.calls[0][0].data.requestHash,
    });
    mediaStorage.uploadChatImage.mockClear();

    const retry = await service.send(
      customerId,
      conversationId,
      clientMessageId,
      [createFile()],
    );

    expect(retry.message.id).toBe(first.message.id);
    expect(mediaStorage.uploadChatImage).not.toHaveBeenCalled();
  });

  it('deletes uploaded assets when the database transaction fails', async () => {
    const { service, db, mediaStorage } = setup();
    db.$transaction.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.send(customerId, conversationId, clientMessageId, [createFile()]),
    ).rejects.toThrow('database unavailable');
    expect(mediaStorage.deleteImage).toHaveBeenCalledWith(
      'lambe/chat/conversation/image',
      'authenticated',
    );
  });

  it('does not upload when the user cannot access the conversation', async () => {
    const { service, tx, mediaStorage } = setup();
    tx.chatConversation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.send('outsider', conversationId, clientMessageId, [createFile()]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mediaStorage.uploadChatImage).not.toHaveBeenCalled();
  });

  it('rejects reusing a client message ID with different image bytes', async () => {
    const { service, tx } = setup();
    tx.chatMessage.findUnique.mockResolvedValue({
      id: 'existing-message',
      conversationId,
      sequence: 1,
      senderUserId: customerId,
      kind: ChatMessageKind.IMAGE,
      clientMessageId,
      requestHash: 'different',
      text: null,
      providerServiceId: null,
      orderId: null,
      eventKey: null,
      payload: null,
      createdAt: new Date(),
      attachments: [],
    });

    await expect(
      service.send(customerId, conversationId, clientMessageId, [createFile()]),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
