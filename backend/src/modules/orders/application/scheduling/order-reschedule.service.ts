import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { resolveOrderTime } from '../../domain/order-time.policy';
import { assessSlot, MINUTE, DAY } from '../../domain/booking-calendar.policy';
import type {
  DecideOrderRescheduleDto,
  RequestOrderRescheduleDto,
} from '../../dto/order.dto';
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
  ) {}

  async request(
    customerId: string,
    orderId: string,
    dto: RequestOrderRescheduleDto,
    metadata: RequestMetadata,
  ) {
    const now = new Date();
    const proposedStartAt = resolveOrderTime('SCHEDULED', dto.scheduledAt, now);
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.serviceOrder.findFirst({
        where: { id: orderId, customerId },
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
        include: { provider: { select: { userId: true, workingHours: true } } },
      });
      if (order.status !== 'ACCEPTED' || order.bookingType !== 'SCHEDULED')
        throw new ConflictException(
          'Chỉ đổi lịch đơn đặt trước đã được thợ nhận và chưa khởi hành.',
        );
      if (proposedStartAt.getTime() === order.expectedStartAt.getTime())
        throw new ConflictException('Giờ đề xuất trùng lịch hiện tại.');
      await tx.orderRescheduleRequest.updateMany({
        where: { orderId, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'REJECTED', respondedAt: now },
      });
      const pending = await tx.orderRescheduleRequest.findFirst({
        where: { orderId, status: 'PENDING' },
      });
      if (pending)
        throw new ConflictException(
          'Đơn đang chờ thợ phản hồi yêu cầu đổi lịch.',
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
        data: { orderId, proposedStartAt, proposedEndAt, expiresAt },
      });
      await tx.orderNotification.create({
        data: {
          userId: orderServingUserId(order),
          orderId,
          event: 'ORDER_RESCHEDULE_REQUESTED',
        },
      });
      await this.audit.record(
        {
          actorUserId: customerId,
          action: 'ORDER_RESCHEDULE_REQUESTED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return { success: true, data: proposal };
    });
  }

  async decide(
    userId: string,
    orderId: string,
    dto: DecideOrderRescheduleDto,
    metadata: RequestMetadata,
  ) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.serviceOrder.findFirst({
        where: { id: orderId, ...servingOrderWhere(userId) },
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
        include: { provider: { select: { workingHours: true } } },
      });
      await assertAssignedMemberActive(tx, order, userId);
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
      }
      const updated = await tx.orderRescheduleRequest.update({
        where: { id: proposal.id },
        data: {
          status: dto.approve ? 'ACCEPTED' : 'REJECTED',
          respondedAt: now,
        },
      });
      await tx.orderNotification.create({
        data: {
          userId: order.customerId,
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
      return { success: true, data: updated };
    });
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
