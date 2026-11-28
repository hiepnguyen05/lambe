import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OrderOperationalAlertStatus,
  OrderOperationalAlertType,
  Prisma,
  InternalRole,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { MailOutboxService } from '../../../../infrastructure/mail/mail-outbox.service';
import type { AuthenticatedInternalAccount } from '../../../internal-auth/types/authenticated-internal-account.type';
import { orderServingUserId } from '../persistence/order-actor.policy';
import {
  ACCEPTED_OVERDUE_MINUTES,
  EN_ROUTE_OVERDUE_MINUTES,
  ARRIVED_OVERDUE_MINUTES,
} from '../../domain/order-time.policy';

const WATCHDOG_LOCK_ID = 127_001_004;

const alertSelect = {
  id: true,
  type: true,
  status: true,
  detectedAt: true,
  acknowledgedAt: true,
  acknowledgedById: true,
  resolvedAt: true,
  resolvedById: true,
  resolutionNote: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      status: true,
      serviceName: true,
      providerDisplayName: true,
      expectedStartAt: true,
      expectedEndAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrderOperationalAlertSelect;

@Injectable()
export class OrderOperationalAlertService {
  private readonly logger = new Logger(OrderOperationalAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailOutboxService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'detect-stale-service-orders',
    waitForCompletion: true,
  })
  async scan(): Promise<{ created: number; autoResolved: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(${WATCHDOG_LOCK_ID}) AS acquired`,
      );
      if (!lock?.acquired) return { created: [], autoResolved: [], queued: 0 };

      const autoResolved = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "order_operational_alerts" alert
        SET "status" = 'RESOLVED', "resolvedAt" = NOW(),
            "resolutionNote" = COALESCE(alert."resolutionNote", 'AUTO_STATUS_CHANGED'),
            "updatedAt" = NOW()
        WHERE alert."status" IN ('OPEN', 'ACKNOWLEDGED')
          AND (
            (alert."type" = 'ACCEPTED_START_OVERDUE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'ACCEPTED'
            )) OR
            (alert."type" = 'EN_ROUTE_OVERDUE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'EN_ROUTE'
            )) OR
            (alert."type" = 'ARRIVAL_START_OVERDUE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'ARRIVED'
            )) OR
            (alert."type" = 'SERVICE_COMPLETION_OVERDUE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'IN_PROGRESS'
            )) OR
            (alert."type" = 'SAFETY_HOLD_STALE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'SAFETY_HOLD'
            )) OR
            (alert."type" = 'PAYMENT_DISPUTE_STALE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'PAYMENT_DISPUTE'
            )) OR
            (alert."type" = 'DISPUTED_STALE' AND NOT EXISTS (
              SELECT 1 FROM "service_orders" o WHERE o."id" = alert."orderId" AND o."status" = 'DISPUTED'
            )) OR
            (alert."type" = 'CANCELLATION_REVIEW_STALE' AND NOT EXISTS (
              SELECT 1 FROM "order_cancellation_requests" c
              WHERE c."orderId" = alert."orderId" AND c."status" = 'SUPPORT_REVIEW'
            ))
          )
        RETURNING alert."id"
      `);

      const created = await tx.$queryRaw<
        Array<{ id: string; orderId: string; type: OrderOperationalAlertType }>
      >(Prisma.sql`
        WITH candidates("orderId", "type", "enteredAt", "dueAt") AS (
          SELECT "id", 'ACCEPTED_START_OVERDUE', GREATEST(COALESCE("acceptedAt", "updatedAt"), "updatedAt"), "expectedStartAt" + ${ACCEPTED_OVERDUE_MINUTES} * INTERVAL '1 minute'
          FROM "service_orders" WHERE "status" = 'ACCEPTED' AND "expectedStartAt" + ${ACCEPTED_OVERDUE_MINUTES} * INTERVAL '1 minute' <= NOW()
          UNION ALL
          SELECT "id", 'EN_ROUTE_OVERDUE', COALESCE("enRouteAt", "updatedAt"), "expectedStartAt" + ${EN_ROUTE_OVERDUE_MINUTES} * INTERVAL '1 minute'
          FROM "service_orders" WHERE "status" = 'EN_ROUTE' AND "expectedStartAt" + ${EN_ROUTE_OVERDUE_MINUTES} * INTERVAL '1 minute' <= NOW()
          UNION ALL
          SELECT "id", 'ARRIVAL_START_OVERDUE', COALESCE("arrivedAt", "updatedAt"), COALESCE("arrivedAt", "updatedAt") + ${ARRIVED_OVERDUE_MINUTES} * INTERVAL '1 minute'
          FROM "service_orders" WHERE "status" = 'ARRIVED' AND COALESCE("arrivedAt", "updatedAt") + ${ARRIVED_OVERDUE_MINUTES} * INTERVAL '1 minute' <= NOW()
          UNION ALL
          SELECT "id", 'SERVICE_COMPLETION_OVERDUE', COALESCE("startedAt", "updatedAt"), "expectedEndAt" + INTERVAL '60 minutes'
          FROM "service_orders" WHERE "status" = 'IN_PROGRESS' AND "expectedEndAt" + INTERVAL '60 minutes' <= NOW()
          UNION ALL
          SELECT o."id", 'SAFETY_HOLD_STALE', COALESCE(i."createdAt", o."updatedAt"), COALESCE(i."createdAt", o."updatedAt") + INTERVAL '15 minutes'
          FROM "service_orders" o LEFT JOIN "order_safety_incidents" i ON i."orderId" = o."id"
          WHERE o."status" = 'SAFETY_HOLD' AND COALESCE(i."createdAt", o."updatedAt") + INTERVAL '15 minutes' <= NOW()
          UNION ALL
          SELECT "id", 'PAYMENT_DISPUTE_STALE', COALESCE("paymentDisputeOpenedAt", "updatedAt"), COALESCE("paymentDisputeOpenedAt", "updatedAt") + INTERVAL '24 hours'
          FROM "service_orders" WHERE "status" = 'PAYMENT_DISPUTE' AND COALESCE("paymentDisputeOpenedAt", "updatedAt") + INTERVAL '24 hours' <= NOW()
          UNION ALL
          SELECT "id", 'DISPUTED_STALE', COALESCE("paymentDisputeDecidedAt", "updatedAt"), COALESCE("paymentDisputeDecidedAt", "updatedAt") + INTERVAL '24 hours'
          FROM "service_orders" WHERE "status" = 'DISPUTED' AND COALESCE("paymentDisputeDecidedAt", "updatedAt") + INTERVAL '24 hours' <= NOW()
          UNION ALL
          SELECT "orderId", 'CANCELLATION_REVIEW_STALE', "requestedAt", "requestedAt" + INTERVAL '2 hours'
          FROM "order_cancellation_requests" WHERE "status" = 'SUPPORT_REVIEW' AND "requestedAt" + INTERVAL '2 hours' <= NOW()
        ), due AS (
          SELECT candidate.* FROM candidates candidate
          WHERE NOT EXISTS (
            SELECT 1 FROM "order_operational_alerts" existing
            WHERE existing."orderId" = candidate."orderId"
              AND existing."type" = candidate."type"::"OrderOperationalAlertType"
              AND (existing."status" IN ('OPEN', 'ACKNOWLEDGED') OR existing."detectedAt" >= candidate."enteredAt")
          )
          ORDER BY candidate."dueAt", candidate."orderId", candidate."type"
          LIMIT 500
        )
        INSERT INTO "order_operational_alerts" (
          "id", "orderId", "type", "status", "detectedAt", "updatedAt"
        )
        SELECT gen_random_uuid()::text, due."orderId",
               due."type"::"OrderOperationalAlertType", 'OPEN', NOW(), NOW()
        FROM due
        ON CONFLICT DO NOTHING
        RETURNING "id", "orderId", "type"
      `);
      const customerFacingTypes: OrderOperationalAlertType[] = [
        OrderOperationalAlertType.ACCEPTED_START_OVERDUE,
        OrderOperationalAlertType.EN_ROUTE_OVERDUE,
        OrderOperationalAlertType.ARRIVAL_START_OVERDUE,
        OrderOperationalAlertType.SERVICE_COMPLETION_OVERDUE,
      ];
      const customerFacing = created.filter((alert) =>
        customerFacingTypes.includes(alert.type),
      );
      if (customerFacing.length) {
        const orders = await tx.serviceOrder.findMany({
          where: { id: { in: customerFacing.map((alert) => alert.orderId) } },
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
              event: 'ORDER_DELAYED',
            })),
          ),
        });
      }
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
      const dueEmails = await tx.orderOperationalAlert.findMany({
        where: {
          status: OrderOperationalAlertStatus.OPEN,
          detectedAt: { gte: sevenDaysAgo },
          OR: [
            { detectedAt: { lte: new Date(Date.now() - 30 * 60_000) } },
            {
              type: OrderOperationalAlertType.SAFETY_HOLD_STALE,
              detectedAt: { lte: new Date(Date.now() - 5 * 60_000) },
            },
          ],
        },
        select: { id: true, orderId: true, type: true },
        orderBy: { detectedAt: 'desc' },
        take: 200,
      });
      const recipients = await tx.internalAccount.findMany({
        where: {
          status: 'ACTIVE',
          email: { not: null },
          roles: {
            some: {
              role: { in: [InternalRole.ADMIN, InternalRole.SUPPORT] },
              revokedAt: null,
            },
          },
        },
        select: { id: true, email: true },
      });
      const mailItems = [
        ...created.flatMap((alert) =>
          recipients.map((recipient) => ({
            input: {
              to: recipient.email!,
              subject: 'Lambe: có đơn cần hỗ trợ',
              text: `Có cảnh báo ${alert.type} cho đơn ${alert.orderId}. Vui lòng mở trang vận hành để xử lý.`,
              html: '',
            },
            deduplicationKey: `order-alert:${alert.id}:initial:${recipient.id}`,
          })),
        ),
        ...dueEmails.flatMap((alert) =>
          recipients.map((recipient) => ({
            input: {
              to: recipient.email!,
              subject: 'Lambe: cảnh báo đơn quá hạn chưa được nhận',
              text: `Cảnh báo ${alert.type} cho đơn ${alert.orderId} chưa được nhận xử lý. Vui lòng kiểm tra trang vận hành.`,
              html: '',
            },
            deduplicationKey: `order-alert:${alert.id}:escalation:${recipient.id}`,
          })),
        ),
      ];
      let queued = 0;
      if (typeof this.mail.enqueueMany === 'function') {
        queued = await this.mail.enqueueMany(mailItems, tx);
      } else {
        for (const item of mailItems) {
          await this.mail.enqueue(item.input, item.deduplicationKey, tx);
          queued++;
        }
      }
      return { created, autoResolved, queued };
    });

    if (result.created.length || result.autoResolved.length || result.queued) {
      const counts = result.created.reduce<Record<string, number>>(
        (all, item) => ({ ...all, [item.type]: (all[item.type] ?? 0) + 1 }),
        {},
      );
      this.logger.warn(
        `Order watchdog created=${result.created.length} autoResolved=${result.autoResolved.length} emailsQueued=${result.queued} types=${JSON.stringify(counts)}`,
      );
    }
    return {
      created: result.created.length,
      autoResolved: result.autoResolved.length,
    };
  }

  async list() {
    const alerts = await this.prisma.orderOperationalAlert.findMany({
      where: {
        status: {
          in: [
            OrderOperationalAlertStatus.OPEN,
            OrderOperationalAlertStatus.ACKNOWLEDGED,
          ],
        },
      },
      select: alertSelect,
      orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { success: true, data: alerts };
  }

  acknowledge(
    id: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    return this.changeStatus(id, actor, request, 'ACKNOWLEDGE');
  }

  resolve(
    id: string,
    resolutionNote: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
  ) {
    return this.changeStatus(id, actor, request, 'RESOLVE', resolutionNote);
  }

  private async changeStatus(
    id: string,
    actor: AuthenticatedInternalAccount,
    request: RequestMetadata,
    action: 'ACKNOWLEDGE' | 'RESOLVE',
    resolutionNote?: string,
  ) {
    const data = await this.prisma.$transaction(async (tx) => {
      const current = await tx.orderOperationalAlert.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current)
        throw new NotFoundException('Không tìm thấy cảnh báo đơn hàng.');
      if (
        current.status !== OrderOperationalAlertStatus.OPEN &&
        action === 'ACKNOWLEDGE'
      )
        throw new ConflictException(
          'Cảnh báo đã được nhận xử lý hoặc giải quyết.',
        );
      if (current.status === OrderOperationalAlertStatus.RESOLVED)
        throw new ConflictException('Cảnh báo này đã được giải quyết.');

      if (action === 'RESOLVE') {
        const alert = await tx.orderOperationalAlert.findUniqueOrThrow({
          where: { id },
          select: {
            type: true,
            orderId: true,
            order: { select: { status: true } },
          },
        });
        const expectedStatus: Partial<
          Record<OrderOperationalAlertType, string>
        > = {
          ACCEPTED_START_OVERDUE: 'ACCEPTED',
          EN_ROUTE_OVERDUE: 'EN_ROUTE',
          ARRIVAL_START_OVERDUE: 'ARRIVED',
          SERVICE_COMPLETION_OVERDUE: 'IN_PROGRESS',
          SAFETY_HOLD_STALE: 'SAFETY_HOLD',
          PAYMENT_DISPUTE_STALE: 'PAYMENT_DISPUTE',
          DISPUTED_STALE: 'DISPUTED',
        };
        if (expectedStatus[alert.type] === alert.order.status)
          throw new ConflictException('Đơn vẫn đang ở trạng thái cần xử lý.');
        if (
          alert.type === OrderOperationalAlertType.CANCELLATION_REVIEW_STALE
        ) {
          const request = await tx.orderCancellationRequest.findUnique({
            where: { orderId: alert.orderId },
            select: { status: true },
          });
          if (request?.status === 'SUPPORT_REVIEW')
            throw new ConflictException('Yêu cầu hủy vẫn đang chờ hỗ trợ.');
        }
      }

      const now = new Date();
      const targetStatus =
        action === 'ACKNOWLEDGE'
          ? OrderOperationalAlertStatus.ACKNOWLEDGED
          : OrderOperationalAlertStatus.RESOLVED;
      const changed = await tx.orderOperationalAlert.updateMany({
        where: {
          id,
          status:
            action === 'ACKNOWLEDGE'
              ? OrderOperationalAlertStatus.OPEN
              : {
                  in: [
                    OrderOperationalAlertStatus.OPEN,
                    OrderOperationalAlertStatus.ACKNOWLEDGED,
                  ],
                },
        },
        data:
          action === 'ACKNOWLEDGE'
            ? {
                status: targetStatus,
                acknowledgedAt: now,
                acknowledgedById: actor.accountId,
              }
            : {
                status: targetStatus,
                resolvedAt: now,
                resolvedById: actor.accountId,
                resolutionNote,
              },
      });
      if (!changed.count)
        throw new ConflictException('Cảnh báo đã được người khác xử lý.');
      const updated = await tx.orderOperationalAlert.findUniqueOrThrow({
        where: { id },
        select: alertSelect,
      });
      await this.audit.record(
        {
          actorInternalAccountId: actor.accountId,
          action: `ORDER_OPERATIONAL_ALERT_${action}D`,
          resourceType: 'OrderOperationalAlert',
          resourceId: id,
          result: 'SUCCESS',
          metadata: { orderId: updated.order.id, type: updated.type },
        },
        request,
        tx,
      );
      return updated;
    });
    return { success: true, data };
  }
}
