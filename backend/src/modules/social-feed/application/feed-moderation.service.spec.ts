import { ConflictException } from '@nestjs/common';
import { FeedPostStatus, FeedReportResolution } from '@prisma/client';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FeedModerationService } from './feed-moderation.service';

describe('FeedModerationService', () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    feedModerationAppeal: { updateMany: jest.fn() },
    feedModerationDecision: {
      create: jest.fn().mockResolvedValue({ id: 'decision-1' }),
    },
    feedPostMedia: { findMany: jest.fn().mockResolvedValue([]) },
    providerProfile: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ userId: 'owner-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    feedNotice: {
      upsert: jest.fn().mockResolvedValue({ id: 'notice-1' }),
      update: jest.fn(),
    },
    userPushDevice: { findMany: jest.fn().mockResolvedValue([]) },
    feedReport: { findUnique: jest.fn(), updateMany: jest.fn() },
    feedPost: {
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'post-1',
        providerId: 'provider-1',
        revisionNumber: 1,
        moderationStatus: 'APPROVED',
        status: 'PUBLISHED',
        createdByUserId: 'owner-1',
      }),
    },
  };
  const db = {
    feedReport: { findMany: jest.fn() },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const audit = { record: jest.fn() };
  const service = new FeedModerationService(
    db as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.feedReport.findUnique.mockResolvedValue({
      id: 'report-1',
      postId: 'post-1',
      resolution: null,
    });
    tx.feedReport.updateMany.mockResolvedValue({ count: 1 });
    tx.feedPost.updateMany.mockResolvedValue({ count: 1 });
    audit.record.mockResolvedValue(undefined);
    db.feedReport.findMany.mockResolvedValue([]);
  });

  it('lists reviewed reports with reviewer audit fields', async () => {
    await service.reports(50, true);
    const calls = db.feedReport.findMany.mock.calls as unknown as Array<
      [
        {
          where: { resolution: { not: null } };
          include: { reviewedBy: { select: Record<string, boolean> } };
          take: number;
        },
      ]
    >;
    expect(calls[0][0]).toMatchObject({
      where: { resolution: { not: null } },
      include: {
        reviewedBy: {
          select: { id: true, username: true, fullName: true },
        },
      },
      take: 50,
    });
  });

  it('hides a reported post and records the reviewer', async () => {
    await service.resolveReport(
      'report-1',
      FeedReportResolution.POST_HIDDEN,
      'moderator-1',
    );
    const postCalls: unknown = tx.feedPost.update.mock.calls;
    const [postCall] = postCalls as [{ data: { status: FeedPostStatus } }][];
    expect(postCall[0].data.status).toBe(FeedPostStatus.HIDDEN);
    const reportCalls: unknown = tx.feedReport.updateMany.mock.calls;
    const [reportCall] = reportCalls as [
      { data: { reviewedById: string; resolution: FeedReportResolution } },
    ][];
    expect(reportCall[0].data.reviewedById).toBe('moderator-1');
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('does not re-resolve an already reviewed report', async () => {
    tx.feedReport.findUnique.mockResolvedValue({
      id: 'report-1',
      postId: 'post-1',
      resolution: FeedReportResolution.DISMISSED,
    });
    await expect(
      service.resolveReport(
        'report-1',
        FeedReportResolution.POST_HIDDEN,
        'moderator-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.feedPost.updateMany).not.toHaveBeenCalled();
  });

  it('never reopens a deleted post', async () => {
    tx.feedPost.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.setStatus('post-1', FeedPostStatus.PUBLISHED, 'moderator-1'),
    ).rejects.toThrow();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
