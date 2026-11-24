import { Prisma } from '@prisma/client';

// Durable in-app delivery and transport outboxes commit with the moderation decision.
export async function feedNotice(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    postId: string;
    event: string;
    sourceKey: string;
    detail: string;
    managed: boolean;
  },
) {
  const notice = await tx.feedNotice.upsert({
    where: { sourceKey: input.sourceKey },
    create: input,
    update: {},
  });
  const devices = await tx.userPushDevice.findMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      user: { status: 'ACTIVE' },
    },
    select: { id: true },
  });
  if (devices.length)
    await tx.pushOutbox.createMany({
      data: devices.map((d) => ({
        userId: input.userId,
        deviceId: d.id,
        deduplicationKey: `FEED_NOTICE:${notice.id}:${d.id}`,
        event: input.event,
        entityType: 'FEED_NOTICE',
        entityId: notice.id,
        sourceId: notice.id,
        recipientRole: input.managed ? 'PROVIDER' : 'CUSTOMER',
      })),
      skipDuplicates: true,
    });
  if (input.managed) {
    const owner = await tx.providerProfile.findFirst({
      where: { userId: input.userId, user: { status: 'ACTIVE' } },
      select: { sourceApplication: { select: { email: true } } },
    });
    if (owner?.sourceApplication.email)
      await tx.mailOutbox.upsert({
        where: { deduplicationKey: `feed-notice:${notice.id}` },
        create: {
          deduplicationKey: `feed-notice:${notice.id}`,
          recipient: owner.sourceApplication.email,
          subject: '[Lambe] Có cập nhật kiểm duyệt bài đăng',
          text: 'Mở ứng dụng Lambe, phần quản lý bài đăng để xem quyết định và quyền khiếu nại.',
          html: '<p>Mở ứng dụng Lambe, phần quản lý bài đăng để xem quyết định và quyền khiếu nại.</p>',
        },
        update: {},
      });
  }
  await tx.feedNotice.update({
    where: { id: notice.id },
    data: { transportQueuedAt: new Date() },
  });
  return notice;
}

export async function notifyFeedAuthor(
  tx: Prisma.TransactionClient,
  post: { id: string; providerId: string; createdByUserId: string | null },
  event: string,
  detail: string,
  source: string,
) {
  const provider = await tx.providerProfile.findUniqueOrThrow({
    where: { id: post.providerId },
    select: { userId: true },
  });
  for (const userId of new Set(
    [post.createdByUserId, provider.userId].filter((id): id is string => !!id),
  ))
    await feedNotice(tx, {
      userId,
      postId: post.id,
      event,
      sourceKey: `${source}:${userId}`,
      detail,
      managed: true,
    });
}

export async function closeFeedReports(
  tx: Prisma.TransactionClient,
  postId: string,
  revision: number,
  resolution: 'NO_VIOLATION' | 'CONTENT_RESTRICTED' | 'CONTENT_REMOVED',
  reviewerId: string | null,
  note: string,
  policyCode?: string,
) {
  const message =
    resolution === 'NO_VIOLATION'
      ? 'Không phát hiện vi phạm.'
      : resolution === 'CONTENT_RESTRICTED'
        ? 'Nội dung đã bị hạn chế gợi ý.'
        : 'Nội dung đã được rút khỏi bảng tin.';
  // Bulk notify all reporters without an unbounded application loop or exposing the author.
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO feed_notices(id,"userId","postId",event,"sourceKey",detail,managed)
    SELECT gen_random_uuid()::text,r."userId",r."postId",'FEED_REPORT_RESOLVED','report:' || r.id,
      'Báo cáo của bạn đã được xem xét. ' || ${message},false
    FROM feed_reports r WHERE r."postId"=${postId} AND r."revisionNumber"=${revision} AND r.resolution IS NULL
    ON CONFLICT ("sourceKey") DO NOTHING`);
  await tx.feedReport.updateMany({
    where: { postId, revisionNumber: revision, resolution: null },
    data: {
      resolution,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      note,
      policyCode,
    },
  });
}
