import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/postgres/prisma.service';

const CLEANUP_ADVISORY_LOCK_ID = 127_001_003;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'cleanup-expired-records',
    timeZone: 'Asia/Ho_Chi_Minh',
    waitForCompletion: true,
  })
  async cleanupExpiredRecords(): Promise<void> {
    this.logger.log('Starting scheduled cleanup of expired records');

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const result = await this.prisma.$transaction(async (transaction) => {
        const [lock] = await transaction.$queryRaw<
          Array<{ acquired: boolean }>
        >(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${CLEANUP_ADVISORY_LOCK_ID}) AS acquired`,
        );

        if (!lock?.acquired) return null;

        const deletedSessions = await transaction.internalSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: sevenDaysAgo } },
            ],
          },
        });

        return {
          sessionCount: deletedSessions.count,
        };
      });

      if (!result) {
        this.logger.warn(
          'Cleanup skipped because another instance owns the lock',
        );
        return;
      }

      this.logger.log(
        `Cleanup completed: removed ${result.sessionCount} internal sessions`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cleanup error';
      this.logger.error(`Scheduled cleanup failed: ${message}`);
      throw error;
    }
  }
}
