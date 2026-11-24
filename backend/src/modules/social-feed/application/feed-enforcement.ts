import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { closeFeedReports, notifyFeedAuthor } from './feed-notices';

export async function enforceFeedPost(
  tx: Prisma.TransactionClient,
  audit: AuditService,
  postId: string,
  reviewerId: string,
  resolution: 'NO_VIOLATION' | 'CONTENT_RESTRICTED' | 'CONTENT_REMOVED',
  policyCode: string,
  note: string,
  revision?: number,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM feed_posts WHERE id=${postId} FOR UPDATE`,
  );
  const post = await tx.feedPost.findUnique({ where: { id: postId } });
  if (!post || post.status === 'DELETED')
    throw new NotFoundException('Bài đăng đã xóa hoặc không tồn tại.');
  if (revision !== undefined && post.revisionNumber !== revision)
    throw new ConflictException('Báo cáo thuộc phiên bản cũ.');
  if (resolution !== 'NO_VIOLATION') {
    await tx.feedModerationAppeal.updateMany({
      where: { postId, status: 'PENDING' },
      data: {
        status: 'WITHDRAWN',
        reviewedAt: new Date(),
        note: 'Có quyết định kiểm duyệt mới.',
      },
    });
    await tx.feedPost.update({
      where: { id: postId },
      data: {
        recommendationStatus: 'INELIGIBLE',
        ...(resolution === 'CONTENT_REMOVED' && {
          status: 'HIDDEN',
          moderationStatus: 'REJECTED',
        }),
        moderationPolicyCode: policyCode,
        moderationNote: note,
        moderationReviewedById: reviewerId,
        moderationReviewedAt: new Date(),
      },
    });
    const decision = await tx.feedModerationDecision.create({
      data: {
        postId,
        revisionNumber: post.revisionNumber,
        status:
          resolution === 'CONTENT_REMOVED' ? 'REJECTED' : post.moderationStatus,
        recommendationStatus: 'INELIGIBLE',
        policyCode,
        note,
        reviewerId,
        source: 'REPORT',
      },
    });
    if (
      resolution === 'CONTENT_REMOVED' &&
      [
        'SEXUAL_OR_NUDITY',
        'VIOLENCE_OR_GRAPHIC',
        'COPYRIGHT_OR_REUPLOAD',
      ].includes(policyCode)
    ) {
      const media = await tx.feedPostMedia.findMany({
        where: { postId, sha256: { not: null } },
        select: { sha256: true },
      });
      if (media.length)
        await tx.feedBlockedMedia.createMany({
          data: media.map((m) => ({
            sha256: m.sha256!,
            postId,
            revisionNumber: post.revisionNumber,
          })),
          skipDuplicates: true,
        });
    }
    await notifyFeedAuthor(
      tx,
      post,
      'FEED_MODERATION_DECIDED',
      `${resolution === 'CONTENT_REMOVED' ? 'Bài đã được rút khỏi bảng tin.' : 'Bài không được đưa vào gợi ý.'} ${note}${resolution === 'CONTENT_REMOVED' ? ' Bạn có thể khiếu nại trong 30 ngày.' : ''}`,
      decision.id,
    );
  }
  await closeFeedReports(
    tx,
    postId,
    post.revisionNumber,
    resolution,
    reviewerId,
    note,
    policyCode,
  );
  await audit.record(
    {
      actorInternalAccountId: reviewerId,
      action: 'FEED_REPORTS_RESOLVED',
      resourceType: 'FEED_POST',
      resourceId: postId,
      result: 'SUCCESS',
      metadata: { resolution, revisionNumber: post.revisionNumber, policyCode },
    },
    {},
    tx,
  );
  return { id: postId, resolution };
}
