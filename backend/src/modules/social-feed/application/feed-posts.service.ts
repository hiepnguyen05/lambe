import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FeedSafetyService } from './feed-safety.service';
import { closeFeedReports } from './feed-notices';
import { FeedMediaKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import type { UploadResult } from '../../upload/application/media-storage.port';
import {
  FEED_MEDIA_STORAGE,
  type FeedMediaStorage,
} from './feed-media-storage.port';
import { CreateFeedPostDto, UpdateFeedPostDto } from '../dto/feed.dto';
import { validateFeedMedia } from './feed-media';
import { FeedQueryService } from './feed-query.service';
import { FeedAccessService } from './organization/feed-access.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  FeedMediaCleanupService,
  type FeedCleanupItem,
} from './feed-media-cleanup.service';

@Injectable()
export class FeedPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: FeedQueryService,
    @Inject(FEED_MEDIA_STORAGE) private readonly media: FeedMediaStorage,
    private readonly access: FeedAccessService,
    private readonly audit: AuditService,
    private readonly cleanup: FeedMediaCleanupService,
    @Optional() private readonly safety?: FeedSafetyService,
  ) {}

  async create(
    userId: string,
    dto: CreateFeedPostDto,
    files: Express.Multer.File[],
    metadata: RequestMetadata = {},
    idempotencyKey = '',
  ) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey))
      throw new BadRequestException(
        'Cần Idempotency-Key từ 8 đến 128 ký tự chữ, số, _ hoặc -.',
      );
    const kind = validateFeedMedia(files);
    if (dto.includesCustomer && !dto.hasCustomerConsent) {
      throw new BadRequestException(
        'Cần xác nhận quyền sử dụng hình ảnh khách hàng.',
      );
    }
    const requestHash = this.creationHash(dto, files);
    const previous = await this.prisma.feedPost.findUnique({
      where: {
        createdByUserId_clientRequestId: {
          createdByUserId: userId,
          clientRequestId: idempotencyKey,
        },
      },
      select: { id: true, requestHash: true },
    });
    if (previous) {
      this.assertSameRequest(previous.requestHash, requestHash);
      return this.queries.ownedDetail(previous.id, userId);
    }
    const original = await this.access.resolve(userId, dto.memberId);
    await this.safety?.assertProvider(original.providerId);
    const mediaHashes = FeedSafetyService.hashes(files);
    await this.safety?.assertAllowed(mediaHashes);
    await this.access.assertServices(original, dto.providerServiceIds);

    const uploaded: (UploadResult & { durationSeconds?: number })[] = [];
    let persisted = false;
    try {
      for (const file of files) {
        const result: UploadResult & { durationSeconds?: number } =
          kind === FeedMediaKind.VIDEO
            ? await this.media.uploadFeedVideo(
                file.buffer,
                `lambe/feed/${original.providerId}`,
              )
            : await this.media.uploadFeedImage(
                file.buffer,
                `lambe/feed/${original.providerId}`,
              );
        uploaded.push(result);
        if (
          kind === FeedMediaKind.VIDEO &&
          (!result.durationSeconds || result.durationSeconds > 60)
        ) {
          throw new BadRequestException('Video phải dài tối đa 60 giây.');
        }
      }

      // No network upload inside the transaction. Recheck membership/version and qualification under locks.
      let postId: string;
      try {
        const post = await this.prisma.$transaction(async (tx) => {
          const actor = await this.access.resolve(
            userId,
            dto.memberId,
            tx,
            true,
          );
          if (
            actor.providerId !== original.providerId ||
            actor.memberId !== original.memberId ||
            actor.membershipVersion !== original.membershipVersion
          )
            throw new ConflictException(
              'Ngữ cảnh thành viên đã thay đổi trong lúc tải lên.',
            );
          await this.access.assertServices(actor, dto.providerServiceIds, tx);
          await this.safety?.assertProvider(actor.providerId, tx);
          await this.safety?.assertAllowed(mediaHashes, tx);
          const created = await tx.feedPost.create({
            data: {
              createdByUserId: userId,
              clientRequestId: idempotencyKey,
              requestHash,
              providerId: actor.providerId,
              authorMemberId: actor.memberId,
              authorMembershipVersion: actor.membershipVersion,
              authorRole: actor.memberId ? actor.role : null,
              authorDisplayName: actor.memberId ? actor.displayName : null,
              authorAvatarUrl: actor.memberId ? actor.avatarUrl : null,
              ...(actor.providerType === 'ORGANIZATION' && {
                organizationReviewStatus:
                  actor.role === 'WORKER'
                    ? ('PENDING' as const)
                    : ('APPROVED' as const),
                organizationReviewedAt:
                  actor.role === 'OWNER' ? new Date() : null,
                organizationReviewedByUserId:
                  actor.role === 'OWNER' ? userId : null,
              }),
              caption: dto.caption,
              safetyScore: this.safety?.signals(dto.caption).score ?? 0,
              safetyLabels: this.safety?.signals(dto.caption).labels ?? [],
              safetyCheckedAt: new Date(),
              moderationStatus: 'PENDING',
              recommendationStatus: 'INELIGIBLE',
              includesCustomer: dto.includesCustomer,
              hasCustomerConsent: dto.hasCustomerConsent,
              media: {
                create: uploaded.map((item, position) => ({
                  kind,
                  sha256: mediaHashes[position],
                  deliveryType: item.deliveryType ?? 'upload',
                  publicId: item.publicId,
                  secureUrl: item.secureUrl,
                  format: item.format,
                  width: item.width,
                  height: item.height,
                  durationSeconds: item.durationSeconds,
                  position,
                })),
              },
              services: {
                create: dto.providerServiceIds.map((providerServiceId) => ({
                  providerServiceId,
                })),
              },
            },
          });
          await this.audit.record(
            {
              actorUserId: userId,
              action: 'FEED_POST_CREATED',
              resourceType: 'FEED_POST',
              resourceId: created.id,
              result: 'SUCCESS',
              metadata: {
                providerId: actor.providerId,
                memberId: actor.memberId,
                membershipVersion: actor.membershipVersion,
              },
            },
            metadata,
            tx,
          );
          return created;
        });
        postId = post.id;
        persisted = true;
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
        const raced = await this.prisma.feedPost.findUnique({
          where: {
            createdByUserId_clientRequestId: {
              createdByUserId: userId,
              clientRequestId: idempotencyKey,
            },
          },
          select: { id: true, requestHash: true },
        });
        if (!raced) throw error;
        this.assertSameRequest(raced.requestHash, requestHash);
        postId = raced.id;
      }
      return this.queries.ownedDetail(postId, userId);
    } finally {
      if (!persisted) {
        const cleanupItems = uploaded.map((item) => ({
          publicId: item.publicId,
          deliveryType: item.deliveryType,
          kind:
            item.resourceType === 'video'
              ? FeedMediaKind.VIDEO
              : FeedMediaKind.IMAGE,
        }));
        await this.cleanup.enqueueAfterFailure(cleanupItems);
        await this.cleanup.removeNow(cleanupItems);
      }
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFeedPostDto,
    metadata: RequestMetadata = {},
  ) {
    if (dto.caption === undefined && dto.providerServiceIds === undefined)
      throw new BadRequestException('Chưa có nội dung cần sửa.');
    await this.prisma.$transaction(async (tx) => {
      const { actor, candidate } = await this.access.forPost(tx, userId, id);
      const author =
        actor.role === 'WORKER'
          ? actor
          : await this.access.author(tx, candidate, actor);
      const post = await this.access.lockPost(tx, id, actor);
      await closeFeedReports(
        tx,
        id,
        post.revisionNumber,
        'CONTENT_REMOVED',
        null,
        'Phiên bản cũ đã rút khỏi công khai để chỉnh sửa.',
      );
      await this.safety?.assertProvider(actor.providerId, tx);
      await tx.feedModerationAppeal.updateMany({
        where: { postId: id, status: 'PENDING' },
        data: {
          status: 'WITHDRAWN',
          reviewedAt: new Date(),
          note: 'Bài đã sửa; cần kiểm duyệt phiên bản mới.',
        },
      });
      if (
        dto.revisionNumber !== undefined &&
        dto.revisionNumber !== post.revisionNumber
      )
        throw new ConflictException('Bài đã có phiên bản mới.');
      await this.access.assertServices(
        author,
        dto.providerServiceIds ?? post.services.map((s) => s.providerServiceId),
        tx,
      );
      await tx.feedPost.update({
        where: { id },
        data: {
          ...(dto.caption !== undefined && { caption: dto.caption }),
          revisionNumber: { increment: 1 },
          moderationStatus: 'PENDING',
          recommendationStatus: 'INELIGIBLE',
          moderationPolicyCode: null,
          moderationNote: null,
          moderationReviewedAt: null,
          moderationReviewedById: null,
          safetyScore:
            this.safety?.signals(dto.caption ?? post.caption).score ?? 0,
          safetyLabels:
            this.safety?.signals(dto.caption ?? post.caption).labels ?? [],
          safetyCheckedAt: new Date(),
          ...(post.authorRole === 'WORKER' && {
            organizationReviewStatus: 'PENDING',
            organizationReviewedAt: null,
            organizationReviewedByUserId: null,
            organizationReviewNote: null,
          }),
          ...(post.authorRole === 'OWNER' &&
            post.organizationReviewStatus === 'APPROVED' && {
              organizationReviewedAt: new Date(),
              organizationReviewedByUserId: userId,
              organizationReviewNote: null,
            }),
        },
      });
      if (dto.providerServiceIds) {
        await tx.feedPostService.deleteMany({ where: { postId: id } });
        await tx.feedPostService.createMany({
          data: dto.providerServiceIds.map((providerServiceId) => ({
            postId: id,
            providerServiceId,
          })),
        });
      }
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'FEED_POST_UPDATED',
          resourceType: 'FEED_POST',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { revisionNumber: post.revisionNumber + 1 },
        },
        metadata,
        tx,
      );
    });
    return this.queries.ownedDetail(id, userId);
  }

  async remove(userId: string, id: string, metadata: RequestMetadata = {}) {
    let media: FeedCleanupItem[] = [];
    await this.prisma.$transaction(async (tx) => {
      const { actor } = await this.access.forPost(tx, userId, id);
      await this.access.lockPost(tx, id, actor);
      media = await tx.feedPostMedia.findMany({
        where: { postId: id },
        select: { publicId: true, kind: true, deliveryType: true },
      });
      await tx.feedPost.update({ where: { id }, data: { status: 'DELETED' } });
      await tx.feedModerationAppeal.updateMany({
        where: { postId: id, status: 'PENDING' },
        data: {
          status: 'WITHDRAWN',
          reviewedAt: new Date(),
          note: 'Bài đăng đã xóa.',
        },
      });
      await this.cleanup.enqueue(media, tx);
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'FEED_POST_DELETED',
          resourceType: 'FEED_POST',
          resourceId: id,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
    });
    await this.cleanup.removeNow(media);
    return { deleted: true };
  }

  private creationHash(dto: CreateFeedPostDto, files: Express.Multer.File[]) {
    const mediaHashes = files.map((file) =>
      createHash('sha256').update(file.buffer).digest('hex'),
    );
    return createHash('sha256')
      .update(
        JSON.stringify({
          caption: dto.caption,
          memberId: dto.memberId ?? null,
          providerServiceIds: [...dto.providerServiceIds].sort(),
          includesCustomer: dto.includesCustomer,
          hasCustomerConsent: dto.hasCustomerConsent,
          mediaHashes,
        }),
      )
      .digest('hex');
  }

  private assertSameRequest(previousHash: string | null, requestHash: string) {
    if (previousHash !== requestHash)
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key đã dùng cho bài đăng khác.',
      });
  }
}
