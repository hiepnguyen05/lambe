import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma, type PushOutbox } from '@prisma/client';
import { getMessaging } from 'firebase-admin/messaging';
import {
  currentRequestId,
  runWithRequestId,
} from '../../../common/http/request-context';
import { ObservabilityMetrics } from '../../../infrastructure/observability/observability-metrics.service';
import { FirebaseIdentityService } from '../../../infrastructure/firebase/firebase-identity.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { pushContent } from './push-content';
import { findAccessibleChat } from '../../chat/application/chat.helpers';
import {
  canReceiveOrderPush,
  orderPushAudienceSelect,
} from '../../orders/application/notifications/order-notification-recipient.policy';
import { canReceiveProviderNotification } from '../../provider-notifications/application/provider-notification-push.policy';
import { canReadFeedNotice } from '../../social-feed/application/feed-notice-access';

const MAX_ATTEMPTS = 8;

@Injectable()
export class PushOutboxService {
  private readonly logger = new Logger(PushOutboxService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseIdentityService,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
  ) {}

  async enqueue(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      sourceId: string;
      event: string;
      entityType:
        | 'ORDER'
        | 'CHAT'
        | 'APPLICATION'
        | 'SERVICE_CHANGE'
        | 'FEED_NOTICE'
        | 'PROVIDER_NOTIFICATION';
      entityId: string;
      recipientRole: 'CUSTOMER' | 'PROVIDER' | 'PROVIDER_OWNER';
    },
  ): Promise<void> {
    const devices = await tx.userPushDevice.findMany({
      where: {
        userId: input.userId,
        revokedAt: null,
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    if (!devices.length) return;
    await tx.pushOutbox.createMany({
      data: devices.map(({ id }) => ({
        userId: input.userId,
        deviceId: id,
        deduplicationKey: `${input.entityType}:${input.sourceId}:${id}`,
        event: input.event,
        entityType: input.entityType,
        entityId: input.entityId,
        sourceId: input.sourceId,
        recipientRole: input.recipientRole,
      })),
      skipDuplicates: true,
    });
  }

  @Interval(5_000)
  async deliverPending(): Promise<void> {
    if (
      this.processing ||
      this.config.get<boolean>('firebase.enabled') !== true
    )
      return;
    this.processing = true;
    return runWithRequestId(undefined, async () => {
      const counts = { sent: 0, retry: 0, invalid: 0, failed: 0, errors: 0 };
      try {
        for (let i = 0; i < 20; i++) {
          const [row] = await this.prisma.$queryRaw<PushOutbox[]>(Prisma.sql`
          WITH candidate AS (
            SELECT "id" FROM "push_outbox"
            WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "availableAt" <= NOW()
              AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
            ORDER BY "availableAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1
          )
          UPDATE "push_outbox" AS push
          SET "lockedUntil" = NOW() + INTERVAL '2 minutes', "attempts" = push."attempts" + 1
          FROM candidate WHERE push."id" = candidate."id" RETURNING push.*
        `);
          if (!row) break;
          const result = await this.deliver(row).catch((error: unknown) => {
            this.metrics?.recordEvent('push', 'delivery-error');
            throw error;
          });
          counts[result]++;
          this.metrics?.recordPushOutcome(
            result === 'invalid' ? 'token-invalid' : result,
          );
        }
      } catch {
        counts.errors++;
      } finally {
        this.processing = false;
        this.metrics?.recordWorkerRun('push', counts.errors ? 'error' : 'ok');
        const summary = {
          event: 'push.poll',
          requestId: currentRequestId(),
          counts,
        };
        if (counts.errors) this.logger.warn(summary);
        else if (counts.sent || counts.retry || counts.invalid || counts.failed)
          this.logger.log(summary);
      }
    });
  }

  private async deliver(
    row: PushOutbox,
  ): Promise<'sent' | 'retry' | 'invalid' | 'failed'> {
    const lease = {
      id: row.id,
      attempts: row.attempts,
      lockedUntil: row.lockedUntil,
      sentAt: null,
      failedAt: null,
    };
    const device = await this.prisma.userPushDevice.findFirst({
      where: {
        id: row.deviceId,
        userId: row.userId,
        revokedAt: null,
        user: { status: 'ACTIVE' },
      },
      select: { token: true, sessionId: true },
    });
    const session = device
      ? await this.prisma.userSession.findFirst({
          where: {
            id: device.sessionId,
            userId: row.userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        })
      : null;
    if (!device || !session) {
      await this.prisma.pushOutbox.updateMany({
        where: lease,
        data: { failedAt: new Date(), lockedUntil: null },
      });
      return 'failed';
    }
    try {
      if (
        row.entityType === 'FEED_NOTICE' &&
        !(await canReadFeedNotice(this.prisma, row.entityId, row.userId))
      ) {
        await this.prisma.pushOutbox.updateMany({
          where: lease,
          data: { failedAt: new Date(), lockedUntil: null },
        });
        return 'failed';
      }
      if (
        row.entityType === 'ORDER' &&
        !canReceiveOrderPush(
          await this.prisma.serviceOrder.findUnique({
            where: { id: row.entityId },
            select: orderPushAudienceSelect,
          }),
          row.userId,
          row.event,
        )
      ) {
        await this.prisma.pushOutbox.updateMany({
          where: lease,
          data: { failedAt: new Date(), lockedUntil: null },
        });
        return 'failed';
      }
      if (row.entityType === 'CHAT') {
        try {
          await findAccessibleChat(this.prisma, row.entityId, row.userId);
        } catch (error) {
          if (!(error instanceof NotFoundException)) throw error;
          await this.prisma.pushOutbox.updateMany({
            where: lease,
            data: { failedAt: new Date(), lockedUntil: null },
          });
          return 'failed';
        }
      }
      if (
        row.entityType === 'PROVIDER_NOTIFICATION' &&
        !(await canReceiveProviderNotification(
          this.prisma,
          row.entityId,
          row.userId,
          this.config.get<number>('provider.minReceivingBalanceAmount', 50_000),
        ))
      ) {
        await this.prisma.pushOutbox.updateMany({
          where: lease,
          data: { failedAt: new Date(), lockedUntil: null },
        });
        return 'failed';
      }
      const app = await this.firebase.getFirebaseApp();
      const content = pushContent(row.event);
      const messaging = getMessaging(app);
      try {
        await messaging.send({
          token: device.token,
          notification: content,
          data: {
            notificationId: row.sourceId ?? row.id,
            event: row.event,
            entityType: row.entityType,
            entityId: row.entityId,
            recipientRole: row.recipientRole,
            deepLink: this.deepLink(row),
          },
        });
        this.metrics?.recordFirebaseResult('ok');
      } catch (error) {
        this.metrics?.recordFirebaseResult('error');
        throw error;
      }
      await this.prisma.pushOutbox.updateMany({
        where: lease,
        data: { sentAt: new Date(), lockedUntil: null },
      });
      return 'sent';
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      const invalid =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token';
      if (invalid) {
        await this.prisma.$transaction(async (tx) => {
          await tx.userPushDevice.updateMany({
            where: {
              id: row.deviceId,
              userId: row.userId,
              token: device.token,
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
          await tx.pushOutbox.updateMany({
            where: lease,
            data: { failedAt: new Date(), lockedUntil: null },
          });
        });
        return 'invalid';
      }
      const permanent =
        code === 'messaging/mismatched-credential' ||
        code === 'messaging/invalid-argument';
      const exhausted = permanent || row.attempts >= MAX_ATTEMPTS;
      await this.prisma.pushOutbox.updateMany({
        where: lease,
        data: {
          lockedUntil: null,
          failedAt: exhausted ? new Date() : null,
          availableAt: new Date(
            Date.now() + Math.min(3600, 15 * 2 ** (row.attempts - 1)) * 1000,
          ),
        },
      });
      return exhausted ? 'failed' : 'retry';
    }
  }

  private deepLink(row: PushOutbox): string {
    if (row.entityType === 'FEED_NOTICE') return '/feed?notices=true';
    if (row.entityType === 'PROVIDER_NOTIFICATION')
      return `/provider/notifications/${row.entityId}`;
    if (row.entityType === 'CHAT')
      return `/chat/room?conversationId=${row.entityId}`;
    if (row.entityType === 'APPLICATION') return '/partner/status';
    if (row.entityType === 'SERVICE_CHANGE') return '/provider/account';
    return row.recipientRole === 'PROVIDER'
      ? `/provider/orders/${row.entityId}`
      : `/appointments/${row.entityId}`;
  }
}
