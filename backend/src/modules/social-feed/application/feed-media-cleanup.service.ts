import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { FeedMediaKind, Prisma, type FeedMediaCleanup } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  FEED_MEDIA_STORAGE,
  type FeedMediaStorage,
} from './feed-media-storage.port';

export type FeedCleanupItem = {
  publicId: string;
  kind: FeedMediaKind;
  deliveryType?: string;
};

@Injectable()
export class FeedMediaCleanupService {
  private readonly logger = new Logger(FeedMediaCleanupService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEED_MEDIA_STORAGE) private readonly media: FeedMediaStorage,
  ) {}

  async enqueue(
    items: FeedCleanupItem[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!items.length) return;
    await tx.feedMediaCleanup.createMany({ data: items, skipDuplicates: true });
  }

  async enqueueAfterFailure(items: FeedCleanupItem[]): Promise<void> {
    if (!items.length) return;
    try {
      await this.prisma.feedMediaCleanup.createMany({
        data: items,
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.error('feed.media_cleanup.enqueue_failed', error);
    }
  }

  async removeNow(items: FeedCleanupItem[]): Promise<void> {
    await Promise.all(items.map((item) => this.remove(item)));
  }

  @Interval(10_000)
  async deliverPending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      for (let index = 0; index < 10; index++) {
        const rows = await this.prisma.$queryRaw<FeedMediaCleanup[]>(Prisma.sql`
          WITH candidate AS (
            SELECT id FROM feed_media_cleanup
            WHERE "completedAt" IS NULL AND "failedAt" IS NULL
              AND "availableAt" <= NOW()
              AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
            ORDER BY "availableAt", id
            FOR UPDATE SKIP LOCKED LIMIT 1
          )
          UPDATE feed_media_cleanup AS cleanup
          SET "lockedUntil" = date_trunc('milliseconds', NOW()) + INTERVAL '2 minutes',
              attempts = cleanup.attempts + 1,
              "updatedAt" = date_trunc('milliseconds', NOW())
          FROM candidate WHERE cleanup.id = candidate.id
          RETURNING cleanup.*
        `);
        if (!rows.length) break;
        await this.remove(rows[0]);
      }
    } catch (error) {
      this.logger.error('feed.media_cleanup.processing_failed', error);
    } finally {
      this.processing = false;
    }
  }

  private async remove(item: FeedCleanupItem & Partial<FeedMediaCleanup>) {
    try {
      if (item.kind === FeedMediaKind.VIDEO)
        await this.media.deleteFeedVideo(
          item.publicId,
          item.deliveryType === 'authenticated' ? 'authenticated' : 'upload',
        );
      else
        await this.media.deleteImage(
          item.publicId,
          item.deliveryType === 'authenticated' ? 'authenticated' : 'upload',
        );
    } catch (error) {
      await this.scheduleRetry(item, error);
      return;
    }
    try {
      await this.prisma.feedMediaCleanup.updateMany({
        where: { publicId: item.publicId, completedAt: null },
        data: {
          completedAt: new Date(),
          lockedUntil: null,
          lastError: null,
        },
      });
    } catch (error) {
      this.logger.error('feed.media_cleanup.completion_update_failed', error);
    }
  }

  private async scheduleRetry(
    item: FeedCleanupItem & Partial<FeedMediaCleanup>,
    error: unknown,
  ) {
    const attempts = item.attempts ?? 0;
    try {
      await this.prisma.feedMediaCleanup.updateMany({
        where: { publicId: item.publicId, completedAt: null },
        data: {
          lockedUntil: null,
          availableAt: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** Math.min(attempts, 7)) * 1000,
          ),
          lastError: String(error).slice(0, 500),
        },
      });
    } catch (updateError) {
      this.logger.error('feed.media_cleanup.retry_update_failed', updateError);
    }
    this.logger.warn(`feed.media_cleanup.retry_scheduled:${item.publicId}`);
  }
}
