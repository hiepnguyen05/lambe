import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, type OrderRescheduleRequest } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { resolveOrderTime } from '../../domain/order-time.policy';
import { assessSlot, MINUTE, DAY } from '../../domain/booking-calendar.policy';
import type {
  DecideOrderRescheduleDto,
  RequestOrderRescheduleDto,
} from '../../dto/order.dto';
import { OrderNotificationRelayService } from '../notifications/order-notification-relay.service';
import { BookingCalendarService } from './booking-calendar.service';
import { MemberServingService } from '../../../provider-members/application/booking/member-serving.service';
import {
  assertAssignedMemberActive,
  orderServingUserId,
  servingOrderWhere,
} from '../persistence/order-actor.policy';

@Injectable()
export class OrderRescheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BookingCalendarService,
    private readonly audit: AuditService,
    private readonly members: MemberServingService,
    @Optional()
    private readonly notificationRelay?: OrderNotificationRelayService,
  ) {}

  async request(
    userId: string,
    orderId: string,
    dto: RequestOrderRescheduleDto,
    metadata: RequestMetadata,
    asProvider = false,
  ) {
    let now = new Date();
    const proposedStartAt = resolveOrderTime('SCHEDULED', dto.scheduledAt, now);
    return this.prisma
      .$transaction(async (tx) => {
        const owner = await tx.serviceOrder.findFirst({
          where: {
            id: orderId,
            ...(asProvider
              ? servingOrderWhere(userId)
              : { customerId: userId }),
          },
          select: { providerId: true, assignedMemberId: true },
        });
        if (!owner) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
        await this.calendar.lockProvider(
          tx,
          owner.providerId,
          owner.assignedMemberId,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
        );
        const order = await tx.serviceOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            provider: { select: { userId: true, workingHours: true } },
          },
        });
        now = new Date();
        resolveOrderTime('SCHEDULED', dto.scheduledAt, now);
        if (asProvider) await assertAssignedMemberActive(tx, order, userId);
        if (order.status !== 'ACCEPTED' || order.bookingType !== 'SCHEDULED')
          throw new ConflictException(
            'Chỉ đổi lịch đơn đặt trước đã được thợ nhận và chưa khởi hành.',
          );
        if (proposedStartAt.getTime() === order.expectedStartAt.getTime())
          throw new ConflictException('Giờ đề xuất trùng lịch hiện tại.');
        await tx.orderRescheduleRequest.updateMany({
          where: { orderId, status: 'PENDING', expiresAt: { lte: now } },
          data: { status: 'EXPIRED', respondedAt: now },
        });
        const pending = await tx.orderRescheduleRequest.findFirst({
          where: { orderId, status: 'PENDING' },
        });
        if (pending)
          throw new ConflictException(
            'Đơn đang chờ bên còn lại phản hồi yêu cầu đổi lịch.',
          );
        const proposedEndAt = new Date(
          proposedStartAt.getTime() + order.durationMinutes * MINUTE,
        );
        await this.assertSlot(tx, order, proposedStartAt, proposedEndAt, now);
        const expiresAt = new Date(
          Math.min(
            now.getTime() + 30 * MINUTE,
            proposedStartAt.getTime() - 15 * MINUTE,
          ),
        );
        const proposal = await tx.orderRescheduleRequest.create({
          data: {
            orderId,
            proposedStartAt,
            proposedEndAt,
            expiresAt,
            requestedByRole: asProvider ? 'PROVIDER' : 'CUSTOMER',
            requestedByUserId: userId,
          },
        });
        const notification = await tx.orderNotification.create({
          data: {
            userId: asProvider ? order.customerId : orderServingUserId(order),
            orderId,
            event: 'ORDER_RESCHEDULE_REQUESTED',
          },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'ORDER_RESCHEDULE_REQUESTED',
            resourceType: 'ServiceOrder',
            resourceId: orderId,
            result: 'SUCCESS',
          },
          metadata,
          tx,
        );
        return { proposal, notification };
      })
      .then(({ proposal, notification }) => {
        void this.notificationRelay?.publishNow(
          notification.userId,
          notification.id,
        );
        return { success: true, data: this.presentProposal(proposal) };
      });
  }

  async decide(
    userId: string,
    orderId: string,
    dto: DecideOrderRescheduleDto,
    metadata: RequestMetadata,
    asCustomer = false,
  ) {
    let now = new Date();
    return this.prisma
      .$transaction(async (tx) => {
        const owner = await tx.serviceOrder.findFirst({
          where: {
            id: orderId,
            ...(asCustomer
              ? { customerId: userId }
              : servingOrderWhere(userId)),
          },
          select: { providerId: true, assignedMemberId: true },
        });
        if (!owner) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
        await this.calendar.lockProvider(
          tx,
          owner.providerId,
          owner.assignedMemberId,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
        );
        const order = await tx.serviceOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            provider: { select: { userId: true, workingHours: true } },
          },
        });
        now = new Date();
        if (!asCustomer) await assertAssignedMemberActive(tx, order, userId);
        if (order.status !== 'ACCEPTED' || order.bookingType !== 'SCHEDULED')
          throw new ConflictException(
            'Không thể đổi lịch sau khi đơn đã khởi hành.',
          );
        const proposal = await tx.orderRescheduleRequest.findFirst({
          where: {
            id: dto.requestId,
            orderId,
            status: 'PENDING',
            expiresAt: { gt: now },
          },
        });
        if (!proposal)
          throw new ConflictException('Yêu cầu đổi lịch không còn hiệu lực.');
        if (
          (proposal.requestedByRole ?? 'CUSTOMER') !==
            (asCustomer ? 'PROVIDER' : 'CUSTOMER') ||
          proposal.requestedByUserId === userId
        ) {
          throw new ConflictException(
            'Chỉ bên nhận đề xuất mới được phản hồi yêu cầu đổi lịch.',
          );
        }
        if (dto.approve) {
          await this.assertSlot(
            tx,
            order,
            proposal.proposedStartAt,
            proposal.proposedEndAt,
            now,
          );
          await tx.providerCalendarBlock.update({
            where: { orderId },
            data: {
              startAt: proposal.proposedStartAt,
              endAt: proposal.proposedEndAt,
            },
          });
          await tx.serviceOrder.update({
            where: { id: orderId },
            data: {
              scheduledAt: proposal.proposedStartAt,
              expectedStartAt: proposal.proposedStartAt,
              expectedEndAt: proposal.proposedEndAt,
            },
          });
          await tx.orderOperationalAlert.updateMany({
            where: {
              orderId,
              type: 'ACCEPTED_START_OVERDUE',
              status: { in: ['OPEN', 'ACKNOWLEDGED'] },
            },
            data: {
              status: 'RESOLVED',
              resolvedAt: now,
              resolutionNote: 'RESCHEDULE_ACCEPTED',
            },
          });
        }
        const updated = await tx.orderRescheduleRequest
          .update({
            where: {
              id: proposal.id,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            data: {
              status: dto.approve ? 'ACCEPTED' : 'REJECTED',
              respondedAt: now,
            },
          })
          .catch((error: unknown) => {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2025'
            ) {
              throw new ConflictException(
                'Yêu cầu đổi lịch đã hết hạn hoặc đã được phản hồi.',
              );
            }
            throw error;
          });
        const notification = await tx.orderNotification.create({
          data: {
            userId: asCustomer ? orderServingUserId(order) : order.customerId,
            orderId,
            event: dto.approve
              ? 'ORDER_RESCHEDULE_ACCEPTED'
              : 'ORDER_RESCHEDULE_REJECTED',
          },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: dto.approve
              ? 'ORDER_RESCHEDULE_ACCEPTED'
              : 'ORDER_RESCHEDULE_REJECTED',
            resourceType: 'ServiceOrder',
            resourceId: orderId,
            result: 'SUCCESS',
          },
          metadata,
          tx,
        );
        return { updated, notification };
      })
      .then(({ updated, notification }) => {
        void this.notificationRelay?.publishNow(
          notification.userId,
          notification.id,
        );
        return { success: true, data: this.presentProposal(updated) };
      });
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-order-reschedules',
    waitForCompletion: true,
  })
  async expirePendingRequests(): Promise<number> {
    const notices = await this.prisma.$transaction(async (tx) => {
      // Match mutation lock order: order first, then its proposal.
      const orders = await tx.$queryRaw<
        Array<{ id: string; customerId: string; servingUserId: string }>
      >(Prisma.sql`
        SELECT o."id", o."customerId", COALESCE(o."assignedMemberUserId", p."userId") AS "servingUserId"
        FROM "service_orders" o JOIN "provider_profiles" p ON p."id" = o."providerId"
        WHERE EXISTS (SELECT 1 FROM "order_reschedule_requests" r
          WHERE r."orderId" = o."id" AND r."status" = 'PENDING'
            AND (r."expiresAt" <= NOW() OR o."status" <> 'ACCEPTED' OR o."bookingType" <> 'SCHEDULED'))
        ORDER BY o."id" LIMIT 100 FOR UPDATE OF o SKIP LOCKED
      `);
      if (!orders.length) return [];
      const changed = await tx.$queryRaw<
        Array<{ orderId: string; status: string }>
      >(Prisma.sql`
        UPDATE "order_reschedule_requests" r SET
          "status" = (CASE WHEN o."status" = 'ACCEPTED' AND o."bookingType" = 'SCHEDULED'
            THEN 'EXPIRED' ELSE 'CANCELLED' END)::"OrderRescheduleStatus",
          "respondedAt" = NOW()
        FROM "service_orders" o WHERE r."orderId" = o."id"
          AND o."id" IN (${Prisma.join(orders.map((row) => row.id))}) AND r."status" = 'PENDING'
          AND (r."expiresAt" <= NOW() OR o."status" <> 'ACCEPTED' OR o."bookingType" <> 'SCHEDULED')
        RETURNING r."orderId", r."status"
      `);
      const data = changed.flatMap((row) => {
        const owner = orders.find((order) => order.id === row.orderId)!;
        return [...new Set([owner.customerId, owner.servingUserId])].map(
          (userId) => ({
            userId,
            orderId: row.orderId,
            event: `ORDER_RESCHEDULE_${row.status}`,
          }),
        );
      });
      if (data.length) await tx.orderNotification.createMany({ data });
      return data;
    });
    for (const userId of new Set(notices.map((row) => row.userId))) {
      void this.notificationRelay?.publishNow(userId);
    }
    return notices.length;
  }

  private presentProposal(proposal: OrderRescheduleRequest) {
    return {
      id: proposal.id,
      orderId: proposal.orderId,
      requestedByRole: proposal.requestedByRole,
      status: proposal.status,
      proposedStartAt: proposal.proposedStartAt,
      proposedEndAt: proposal.proposedEndAt,
      expiresAt: proposal.expiresAt,
      createdAt: proposal.createdAt,
      respondedAt: proposal.respondedAt,
    };
  }

  private async assertSlot(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      providerId: string;
      providerServiceId: string;
      assignedMemberId?: string | null;
      durationMinutes: number;
      addressLatitude: number;
      addressLongitude: number;
      provider: {
        workingHours: {
          dayOfWeek: number;
          startMinute: number;
          endMinute: number;
        }[];
      };
    },
    startAt: Date,
    endAt: Date,
    now: Date,
  ) {
    const member = order.assignedMemberId
      ? await this.members.get(
          order.assignedMemberId,
          order.providerServiceId,
          startAt,
          new Date(endAt.getTime() + DAY),
          tx,
          endAt,
        )
      : null;
    const key = order.assignedMemberId ?? order.providerId;
    const blocks =
      (
        await this.calendar.read(
          [order.providerId],
          startAt,
          new Date(endAt.getTime() + DAY),
          now,
          tx,
          order.id,
          order.assignedMemberId
            ? new Map([[order.assignedMemberId, order.providerId]])
            : undefined,
        )
      ).get(key) ?? [];
    if (member)
      blocks.push(
        ...member.timeOffs.map((t) => ({ startAt: t.startAt, endAt: t.endAt })),
      );
    const assessment = assessSlot({
      startAt,
      durationMinutes: order.durationMinutes,
      point: {
        latitude: order.addressLatitude,
        longitude: order.addressLongitude,
      },
      hours: member?.hours ?? order.provider.workingHours,
      blocks,
    });
    if (!assessment.available)
      throw new ConflictException({
        code: assessment.reason,
        message: 'Thợ không thể nhận lịch đề xuất này. Vui lòng chọn giờ khác.',
      });
  }
}
