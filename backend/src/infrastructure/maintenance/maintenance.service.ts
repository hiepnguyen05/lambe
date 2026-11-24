import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, ServiceOrderStatus, WalletTopUpStatus } from '@prisma/client';
import { PrismaService } from '../persistence/postgres/prisma.service';
import { orderServingUserId } from '../../modules/orders/application/persistence/order-actor.policy';

const CLEANUP_ADVISORY_LOCK_ID = 127_001_003;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'close-stale-provider-sessions',
    waitForCompletion: true,
  })
  async closeStaleProviderSessions(): Promise<void> {
    const ttlSeconds = this.config.get<number>(
      'cache.providerLocationTtlSeconds',
      120,
    );
    const staleBefore = new Date(Date.now() - ttlSeconds * 1000);
    const result = await this.prisma.providerAvailabilitySession.updateMany({
      where: { endedAt: null, lastHeartbeatAt: { lt: staleBefore } },
      data: { endedAt: new Date(), endReason: 'HEARTBEAT_EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`Closed ${result.count} stale provider sessions`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'close-stale-member-sessions',
    waitForCompletion: true,
  })
  async closeStaleMemberSessions(): Promise<void> {
    const cutoff = new Date(
      Date.now() -
        this.config.get<number>('cache.providerLocationTtlSeconds', 120) * 1000,
    );
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH stale AS (
        SELECT "id" FROM "provider_member_availability_sessions"
        WHERE "endedAt" IS NULL AND "lastHeartbeatAt" <= ${cutoff}
        ORDER BY "lastHeartbeatAt", "id" LIMIT 500 FOR UPDATE SKIP LOCKED
      )
      UPDATE "provider_member_availability_sessions" session
      SET "endedAt" = CURRENT_TIMESTAMP, "endReason" = 'HEARTBEAT_EXPIRED'
      FROM stale WHERE session."id" = stale."id" AND session."endedAt" IS NULL
      RETURNING session."id"
    `);
    if (rows.length)
      this.logger.log(`Closed ${rows.length} stale member sessions`);
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-pending-service-orders',
    waitForCompletion: true,
  })
  async expirePendingServiceOrders(): Promise<void> {
    const now = new Date();
    const count = await this.prisma.$transaction(async (transaction) => {
      const expired = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "service_orders"
          WHERE "status" = 'PENDING_PROVIDER'
            AND "providerResponseDeadlineAt" < ${now}
          ORDER BY "providerResponseDeadlineAt", "id"
          LIMIT 500
          FOR UPDATE SKIP LOCKED
        `,
      );
      if (expired.length === 0) return 0;
      const ids = expired.map((order) => order.id);
      await transaction.serviceOrder.updateMany({
        where: {
          id: { in: ids },
          status: ServiceOrderStatus.PENDING_PROVIDER,
        },
        data: { status: ServiceOrderStatus.EXPIRED },
      });
      await transaction.orderStatusHistory.createMany({
        data: ids.map((orderId) => ({
          orderId,
          fromStatus: ServiceOrderStatus.PENDING_PROVIDER,
          toStatus: ServiceOrderStatus.EXPIRED,
          reason: 'PROVIDER_RESPONSE_TIMEOUT',
        })),
      });
      await transaction.providerCalendarBlock.updateMany({
        where: { orderId: { in: ids }, active: true },
        data: { active: false },
      });
      await transaction.voucherRedemption.updateMany({
        where: { orderId: { in: ids }, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      const owners = await transaction.serviceOrder.findMany({
        where: { id: { in: ids } },
        select: { id: true, customerId: true },
      });
      await transaction.orderNotification.createMany({
        data: owners.map((order) => ({
          userId: order.customerId,
          orderId: order.id,
          event: 'ORDER_EXPIRED',
        })),
      });
      return ids.length;
    });
    if (count > 0) {
      this.logger.log(`Expired ${count} pending service orders`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-order-add-ons',
    waitForCompletion: true,
  })
  async expireOrderAddOns(): Promise<void> {
    const count = await this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<Array<{ orderId: string }>>(Prisma.sql`
        WITH due AS (
          SELECT "id" FROM "order_add_ons"
          WHERE "status" = 'PENDING' AND "expiresAt" <= NOW()
          ORDER BY "expiresAt", "id"
          LIMIT 500 FOR UPDATE SKIP LOCKED
        )
        UPDATE "order_add_ons" AS item
        SET "status" = 'EXPIRED', "respondedAt" = NOW()
        FROM due WHERE item."id" = due."id"
        RETURNING item."orderId"
      `);
      if (!expired.length) return 0;
      const orders = await tx.serviceOrder.findMany({
        where: { id: { in: expired.map((item) => item.orderId) } },
        select: {
          id: true,
          customerId: true,
          assignedMemberUserId: true,
          provider: { select: { userId: true } },
        },
      });
      await tx.orderNotification.createMany({
        data: orders.flatMap((order) =>
          [order.customerId, orderServingUserId(order)].map((userId) => ({
            userId,
            orderId: order.id,
            event: 'ORDER_ADD_ON_EXPIRED',
          })),
        ),
      });
      return expired.length;
    });
    if (count) this.logger.log(`Expired ${count} order add-on requests`);
  }

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'escalate-stale-cancellation-requests',
    waitForCompletion: true,
  })
  async escalateStaleCancellationRequests(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const count = await this.prisma.$transaction(async (tx) => {
      const escalated = await tx.$queryRaw<Array<{ orderId: string }>>(
        Prisma.sql`
          WITH due AS (
            SELECT "id" FROM "order_cancellation_requests"
            WHERE "status" = 'PENDING_CUSTOMER' AND "requestedAt" < ${cutoff}
            ORDER BY "requestedAt", "id"
            LIMIT 500 FOR UPDATE SKIP LOCKED
          )
          UPDATE "order_cancellation_requests" AS request
          SET "status" = 'SUPPORT_REVIEW'
          FROM due WHERE request."id" = due."id"
          RETURNING request."orderId"
        `,
      );
      if (!escalated.length) return 0;
      const orders = await tx.serviceOrder.findMany({
        where: { id: { in: escalated.map((item) => item.orderId) } },
        select: {
          id: true,
          customerId: true,
          assignedMemberUserId: true,
          provider: { select: { userId: true } },
        },
      });
      await tx.orderNotification.createMany({
        data: orders.flatMap((order) =>
          [order.customerId, orderServingUserId(order)].map((userId) => ({
            userId,
            orderId: order.id,
            event: 'CANCELLATION_ESCALATED',
          })),
        ),
      });
      return escalated.length;
    });
    if (count > 0) this.logger.log(`Escalated ${count} cancellation requests`);
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-wallet-top-ups',
    waitForCompletion: true,
  })
  async expireWalletTopUps(): Promise<void> {
    const result = await this.prisma.walletTopUpRequest.updateMany({
      where: {
        status: {
          in: [WalletTopUpStatus.CREATED, WalletTopUpStatus.PENDING_PAYMENT],
        },
        expiresAt: { lt: new Date() },
      },
      data: { status: WalletTopUpStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} wallet top-up requests`);
    }
  }

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
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const result = await this.prisma.$transaction(async (transaction) => {
        const [lock] = await transaction.$queryRaw<
          Array<{ acquired: boolean }>
        >(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${CLEANUP_ADVISORY_LOCK_ID}) AS acquired`,
        );

        if (!lock?.acquired) return null;

        const deletedSetupTokens =
          await transaction.internalSetupToken.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: now } },
                { consumedAt: { lt: sevenDaysAgo } },
              ],
            },
          });

        const deletedSessions = await transaction.internalSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: sevenDaysAgo } },
            ],
          },
        });
        const deletedUserSessions = await transaction.userSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: sevenDaysAgo } },
            ],
          },
        });
        const deletedPushRows = await transaction.pushOutbox.deleteMany({
          where: {
            createdAt: { lt: thirtyDaysAgo },
            OR: [{ sentAt: { not: null } }, { failedAt: { not: null } }],
          },
        });

        return {
          setupTokenCount: deletedSetupTokens.count,
          internalSessionCount: deletedSessions.count,
          userSessionCount: deletedUserSessions.count,
          pushOutboxCount: deletedPushRows.count,
        };
      });

      if (!result) {
        this.logger.warn(
          'Cleanup skipped because another instance owns the lock',
        );
        return;
      }

      this.logger.log(
        `Cleanup completed: removed ${result.setupTokenCount} setup tokens, ${result.internalSessionCount} internal sessions, ${result.userSessionCount} user sessions and ${result.pushOutboxCount} push rows`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cleanup error';
      this.logger.error(`Scheduled cleanup failed: ${message}`);
      throw error;
    }
  }
}
