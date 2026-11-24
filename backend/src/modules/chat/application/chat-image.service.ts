import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ChatMessageKind, Prisma, ProviderProfileStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { PushOutboxService } from '../../push/application/push-outbox.service';
import {
  MEDIA_STORAGE,
  type MediaStorage,
  type UploadResult,
} from '../../upload/application/media-storage.port';
import {
  findAccessibleChat,
  lockAccessibleChat,
  assertChatOpen,
  chatRecipients,
  presentChatMessage,
} from './chat.helpers';

const MAX_CHAT_IMAGE_DIMENSION = 12_000;

interface UploadedChatImage {
  file: Express.Multer.File;
  result: UploadResult;
}

@Injectable()
export class ChatImageService {
  private readonly logger = new Logger(ChatImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
    private readonly cache: RedisCacheService,
    private readonly push: PushOutboxService,
  ) {}

  async send(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    files: Express.Multer.File[],
  ) {
    await findAccessibleChat(this.prisma, conversationId, userId);
    const requestHash = this.hashFiles(files);
    const previous = await this.findPrevious(
      this.prisma,
      conversationId,
      userId,
      clientMessageId,
    );
    if (previous) {
      this.assertMatchingRetry(previous.requestHash, requestHash);
      return {
        conversationId,
        message: presentChatMessage(previous, this.mediaStorage),
      };
    }

    const uploaded = await this.uploadAll(conversationId, files);
    let keepUploads = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conversation = await lockAccessibleChat(
          tx,
          conversationId,
          userId,
        );
        await this.assertCanSend(tx, conversation, userId);

        const retry = await this.findPrevious(
          tx,
          conversationId,
          userId,
          clientMessageId,
        );
        if (retry) {
          this.assertMatchingRetry(retry.requestHash, requestHash);
          return { message: retry, created: false };
        }

        const current = await tx.chatConversation.findUniqueOrThrow({
          where: { id: conversationId },
          select: { lastSequence: true },
        });
        const sequence = current.lastSequence + 1;
        const message = await tx.chatMessage.create({
          data: {
            conversationId,
            sequence,
            senderUserId: userId,
            kind: ChatMessageKind.IMAGE,
            clientMessageId,
            requestHash,
            attachments: {
              create: uploaded.map(({ file, result }, position) => ({
                publicId: result.publicId,
                fileFormat: result.format,
                deliveryType: result.deliveryType,
                byteSize: file.size,
                width: result.width!,
                height: result.height!,
                position,
              })),
            },
          },
          include: { attachments: { orderBy: { position: 'asc' } } },
        });
        await tx.chatConversation.update({
          where: { id: conversationId },
          data: { lastSequence: sequence, lastMessageAt: message.createdAt },
        });
        await tx.chatParticipantState.update({
          where: {
            conversationId_userId: { conversationId, userId },
          },
          data: { lastReadSequence: sequence },
        });
        for (const recipient of chatRecipients(conversation, userId))
          await this.push.enqueue(tx, {
            ...recipient,
            sourceId: message.id,
            event: 'CHAT_MESSAGE',
            entityType: 'CHAT',
            entityId: conversationId,
          });
        return { message, created: true };
      });

      keepUploads = result.created;
      if (result.created) void this.cache.publishChatUpdate(conversationId);
      return {
        conversationId,
        message: presentChatMessage(result.message, this.mediaStorage),
      };
    } finally {
      if (!keepUploads) await this.deleteUploads(uploaded);
    }
  }

  private async assertCanSend(
    tx: Prisma.TransactionClient,
    conversation: Awaited<ReturnType<typeof findAccessibleChat>>,
    userId: string,
  ): Promise<void> {
    assertChatOpen(conversation);
    const provider = await tx.providerProfile.findFirst({
      where: {
        id: conversation.providerId,
        status: ProviderProfileStatus.ACTIVE,
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (!provider)
      throw new ForbiddenException('Hồ sơ thợ không còn hoạt động.');

    const blocked = await tx.chatParticipantState.findFirst({
      where: { conversationId: conversation.id, blockedAt: { not: null } },
      select: { userId: true },
    });
    if (blocked) throw new ConflictException('Hội thoại đã bị chặn.');
    if (
      userId === conversation.provider.userId &&
      conversation.lastSequence === 0
    ) {
      throw new ForbiddenException('Khách chưa bắt đầu cuộc trò chuyện.');
    }
  }

  private findPrevious(
    db: PrismaService | Prisma.TransactionClient,
    conversationId: string,
    userId: string,
    clientMessageId: string,
  ) {
    return db.chatMessage.findUnique({
      where: {
        conversationId_senderUserId_clientMessageId: {
          conversationId,
          senderUserId: userId,
          clientMessageId,
        },
      },
      include: { attachments: { orderBy: { position: 'asc' as const } } },
    });
  }

  private hashFiles(files: Express.Multer.File[]): string {
    const hash = createHash('sha256').update(`${ChatMessageKind.IMAGE}\0`);
    for (const file of files) {
      hash.update(`${file.buffer.length}:`);
      hash.update(file.buffer);
    }
    return hash.digest('hex');
  }

  private assertMatchingRetry(
    previousHash: string | null,
    requestHash: string,
  ): void {
    if (previousHash !== requestHash)
      throw new ConflictException('clientMessageId đã dùng với nội dung khác.');
  }

  private async uploadAll(
    conversationId: string,
    files: Express.Multer.File[],
  ): Promise<UploadedChatImage[]> {
    const results = await Promise.allSettled(
      files.map(async (file) => ({
        file,
        result: await this.mediaStorage.uploadChatImage(
          file.buffer,
          `lambe/chat/${conversationId}`,
        ),
      })),
    );
    const uploaded = results
      .filter(
        (result): result is PromiseFulfilledResult<UploadedChatImage> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) {
      await this.deleteUploads(uploaded);
      throw failed.reason;
    }
    try {
      for (const { result } of uploaded) {
        if (
          result.deliveryType !== 'authenticated' ||
          !result.format ||
          !result.width ||
          !result.height ||
          result.width > MAX_CHAT_IMAGE_DIMENSION ||
          result.height > MAX_CHAT_IMAGE_DIMENSION
        ) {
          throw new BadRequestException(
            'Ảnh phải được lưu riêng tư và không vượt quá 12000 px mỗi chiều.',
          );
        }
      }
      return uploaded;
    } catch (error: unknown) {
      await this.deleteUploads(uploaded);
      throw error;
    }
  }

  private async deleteUploads(images: UploadedChatImage[]): Promise<void> {
    const results = await Promise.allSettled(
      images.map(({ result }) =>
        this.mediaStorage.deleteImage(result.publicId, result.deliveryType),
      ),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0)
      this.logger.warn(`Failed to remove ${failures.length} chat image(s)`);
  }
}
