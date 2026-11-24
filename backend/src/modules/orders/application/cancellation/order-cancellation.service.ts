import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderCancellationReason,
  OrderCancellationStatus,
  Prisma,
  ServiceOrderStatus,
  WalletHoldStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  DecideOrderCancellationDto,
  RequestOrderCancellationDto,
} from '../../dto/order.dto';
import { OrderWalletService } from '../payments/order-wallet.service';
import {
  orderInclude,
  presentForCustomer,
  presentForProvider,
} from '../persistence/order.presenter';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';
import {
  assertAssignedMemberActive,
  orderServingUserId,
  servingOrderWhere,
} from '../persistence/order-actor.policy';

const activeStatuses: ServiceOrderStatus[] = [
  ServiceOrderStatus.EN_ROUTE,
  ServiceOrderStatus.ARRIVED,
  ServiceOrderStatus.IN_PROGRESS,
];

@Injectable()
export class OrderCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: OrderWalletService,
    private readonly calendar: BookingCalendarService,
    private readonly audit: AuditService,
  ) {}

  async recordContactAttempt(userId: string, orderId: string) {
    const attempt = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(
        tx,
        orderId,
        servingOrderWhere(userId),
        userId,
      );
      if (current.status !== ServiceOrderStatus.ARRIVED)
        throw new ConflictException('Chỉ có thể thử gọi khi đã đến nơi.');
      if (current.cancellationRequest)
        throw new ConflictException('Đơn đã có yêu cầu hủy.');
      const previous = current.contactAttempts.at(-1);
      if (current.contactAttempts.length >= 5)
        throw new ConflictException('Đã ghi nhận tối đa 5 lần thử liên hệ.');
      if (previous && Date.now() - previous.attemptedAt.getTime() < 30_000)
        throw new ConflictException(
          'Vui lòng chờ trước khi ghi nhận lần thử tiếp theo.',
        );
      return tx.orderContactAttempt.create({
        data: { orderId },
        select: { id: true, attemptedAt: true },
      });
    });
    return { success: true, data: attempt };
  }

  async request(
    userId: string,
    orderId: string,
    dto: RequestOrderCancellationDto,
    metadata: RequestMetadata,
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(
        tx,
        orderId,
        servingOrderWhere(userId),
        userId,
      );
      if (!activeStatuses.includes(current.status))
        throw new ConflictException(
          'Chỉ có thể yêu cầu hủy sau khi đã khởi hành.',
        );
      if (current.cancellationRequest)
        throw new ConflictException('Đơn đã có yêu cầu hủy.');
      const reasonStatuses: Partial<
        Record<OrderCancellationReason, ServiceOrderStatus[]>
      > = {
        TRANSPORT_ISSUE: [ServiceOrderStatus.EN_ROUTE],
        CUSTOMER_UNREACHABLE: [ServiceOrderStatus.ARRIVED],
        UNSAFE_CONDITIONS: [
          ServiceOrderStatus.ARRIVED,
          ServiceOrderStatus.IN_PROGRESS,
        ],
      };
      if (
        reasonStatuses[dto.reason] &&
        !reasonStatuses[dto.reason]!.includes(current.status)
      )
        throw new ConflictException(
          'Lý do hủy không phù hợp với trạng thái đơn.',
        );
      if (
        dto.reason !== OrderCancellationReason.CUSTOMER_UNREACHABLE &&
        !current.evidence.some((item) => item.type === 'INCIDENT')
      )
        throw new ConflictException('Cần tải ảnh sự cố trước khi yêu cầu hủy.');
      if (dto.reason === OrderCancellationReason.CUSTOMER_UNREACHABLE) {
        const attempts = current.contactAttempts;
        if (
          attempts.length < 2 ||
          attempts.at(-1)!.attemptedAt.getTime() -
            attempts[0].attemptedAt.getTime() <
            5 * 60_000
        )
          throw new ConflictException(
            'Cần ghi nhận hai lần thử liên hệ cách nhau ít nhất 5 phút.',
          );
      }
      await tx.orderCancellationRequest.create({
        data: {
          orderId,
          reason: dto.reason,
          detail: dto.detail,
          requestedByUserId: userId,
        },
      });
      await tx.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId,
          event: 'CANCELLATION_REQUESTED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'ORDER_CANCELLATION_REQUESTED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
          metadata: { reason: dto.reason },
        },
        metadata,
        tx,
      );
      return tx.serviceOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });
    return { success: true, data: presentForProvider(order) };
  }

  async customerDecide(
    userId: string,
    orderId: string,
    dto: DecideOrderCancellationDto,
    metadata: RequestMetadata,
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(tx, orderId, {
        customerId: userId,
      });
      const validStatuses: OrderCancellationStatus[] = [
        OrderCancellationStatus.PENDING_CUSTOMER,
        OrderCancellationStatus.SUPPORT_REVIEW,
      ];
      if (
        !current.cancellationRequest ||
        !validStatuses.includes(current.cancellationRequest.status)
      )
        throw new ConflictException(
          'Không có yêu cầu hủy đang chờ khách xử lý.',
        );
      if (!activeStatuses.includes(current.status))
        throw new ConflictException('Đơn đã đổi trạng thái.');
      if (dto.approve) {
        await this.approve(tx, current, userId);
      } else {
        if (
          current.cancellationRequest.status ===
          OrderCancellationStatus.SUPPORT_REVIEW
        ) {
          throw new ConflictException(
            'Yêu cầu hủy đã đang được tổ hỗ trợ xem xét.',
          );
        }
        await tx.orderCancellationRequest.update({
          where: { orderId },
          data: {
            status: OrderCancellationStatus.SUPPORT_REVIEW,
            decisionNote: dto.note,
          },
        });
      }
      await tx.orderNotification.updateMany({
        where: {
          userId,
          orderId,
          event: 'CANCELLATION_REQUESTED',
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      await tx.orderNotification.create({
        data: {
          userId: orderServingUserId(current),
          orderId,
          event: dto.approve
            ? 'CANCELLATION_APPROVED'
            : 'CANCELLATION_ESCALATED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: dto.approve
            ? 'ORDER_CANCELLATION_APPROVED'
            : 'ORDER_CANCELLATION_ESCALATED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return tx.serviceOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });
    return { success: true, data: presentForCustomer(order) };
  }

  async supportQueue() {
    const requests = await this.prisma.orderCancellationRequest.findMany({
      where: {
        status: OrderCancellationStatus.SUPPORT_REVIEW,
        order: { status: { not: ServiceOrderStatus.SAFETY_HOLD } },
      },
      orderBy: { requestedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        orderId: true,
        reason: true,
        detail: true,
        requestedAt: true,
        decisionNote: true,
      },
    });
    return { success: true, data: requests };
  }

  async supportCancelStale(
    internalId: string,
    alertId: string,
    note: string,
    metadata: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const alert = await tx.orderOperationalAlert.findUnique({
        where: { id: alertId },
        select: { orderId: true, type: true, status: true },
      });
      if (!alert) throw new NotFoundException('Không tìm thấy cảnh báo.');
      if (alert.status === 'RESOLVED')
        throw new ConflictException('Cảnh báo đã được đóng.');
      const allowed: Partial<Record<ServiceOrderStatus, string>> = {
        ACCEPTED: 'ACCEPTED_START_OVERDUE',
        EN_ROUTE: 'EN_ROUTE_OVERDUE',
        ARRIVED: 'ARRIVAL_START_OVERDUE',
      };
      const current = await this.lockAndLoad(tx, alert.orderId);
      if (allowed[current.status] !== alert.type)
        throw new ConflictException(
          'Trạng thái đơn không còn phù hợp với cảnh báo.',
        );
      if (
        current.cancellationRequest &&
        (current.cancellationRequest.status ===
          OrderCancellationStatus.PENDING_CUSTOMER ||
          current.cancellationRequest.status ===
            OrderCancellationStatus.SUPPORT_REVIEW)
      )
        throw new ConflictException(
          'Yêu cầu hủy đang được xử lý qua luồng riêng.',
        );

      await this.wallet.release(tx, current, 'SUPPORT_STALE_ORDER_CANCELLED');
      await this.calendar.release(tx, current.id);
      await tx.voucherRedemption.updateMany({
        where: { orderId: current.id, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      await tx.serviceOrder.update({
        where: { id: current.id },
        data: {
          status: ServiceOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: current.status,
              toStatus: ServiceOrderStatus.CANCELLED,
              reason: 'SUPPORT_STALE_ORDER_CANCELLED',
            },
          },
        },
      });
      await tx.orderNotification.createMany({
        data: [current.customerId, orderServingUserId(current)].map(
          (userId) => ({
            userId,
            orderId: current.id,
            event: 'ORDER_CANCELLED',
          }),
        ),
      });
      const closed = await tx.orderOperationalAlert.updateMany({
        where: {
          id: alertId,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedById: internalId,
          resolutionNote: note,
        },
      });
      if (!closed.count)
        throw new ConflictException('Cảnh báo đã được người khác xử lý.');
      await tx.orderOperationalAlert.updateMany({
        where: {
          orderId: current.id,
          id: { not: alertId },
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedById: internalId,
          resolutionNote: note,
        },
      });
      await this.audit.record(
        {
          actorInternalAccountId: internalId,
          action: 'ORDER_STALE_CANCELLED',
          resourceType: 'ServiceOrder',
          resourceId: current.id,
          result: 'SUCCESS',
          metadata: { alertId, note },
        },
        metadata,
        tx,
      );
      return { id: current.id, status: ServiceOrderStatus.CANCELLED };
    });
    return { success: true, data: result };
  }

  async supportDetail(orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, cancellationRequest: { isNot: null } },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy yêu cầu hủy.');
    return { success: true, data: presentForCustomer(order) };
  }

  async supportDecide(
    internalId: string,
    orderId: string,
    dto: DecideOrderCancellationDto,
    metadata: RequestMetadata,
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(tx, orderId);
      if (
        current.cancellationRequest?.status !==
        OrderCancellationStatus.SUPPORT_REVIEW
      )
        throw new ConflictException('Yêu cầu chưa chuyển đến bộ phận hỗ trợ.');
      if (!activeStatuses.includes(current.status))
        throw new ConflictException('Đơn đã đổi trạng thái.');
      if (dto.approve) {
        await this.approve(tx, current, null);
      } else {
        await tx.orderCancellationRequest.update({
          where: { orderId },
          data: {
            status: OrderCancellationStatus.DENIED,
            decidedAt: new Date(),
            decisionNote: dto.note,
          },
        });
      }
      await tx.orderNotification.createMany({
        data: [current.customerId, orderServingUserId(current)].map(
          (userId) => ({
            userId,
            orderId,
            event: dto.approve
              ? 'CANCELLATION_APPROVED'
              : 'CANCELLATION_DENIED',
          }),
        ),
      });
      await this.audit.record(
        {
          actorInternalAccountId: internalId,
          action: dto.approve
            ? 'ORDER_CANCELLATION_APPROVED'
            : 'ORDER_CANCELLATION_DENIED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return tx.serviceOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });
    return { success: true, data: presentForCustomer(order) };
  }

  private async approve(
    tx: Prisma.TransactionClient,
    current: Awaited<ReturnType<OrderCancellationService['lockAndLoad']>>,
    actorUserId: string | null,
  ) {
    if (current.walletHold?.status === WalletHoldStatus.ACTIVE)
      await this.wallet.release(tx, current, 'CANCELLATION_APPROVED');
    await this.calendar.release(tx, current.id);
    await tx.voucherRedemption.updateMany({
      where: { orderId: current.id, status: 'RESERVED' },
      data: { status: 'RELEASED' },
    });
    await tx.serviceOrder.update({
      where: { id: current.id },
      data: {
        status: ServiceOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: current.status,
            toStatus: ServiceOrderStatus.CANCELLED,
            actorUserId,
            reason: current.cancellationRequest?.reason,
          },
        },
      },
    });
    await tx.orderCancellationRequest.update({
      where: { orderId: current.id },
      data: { status: OrderCancellationStatus.APPROVED, decidedAt: new Date() },
    });
  }

  private async lockAndLoad(
    tx: Prisma.TransactionClient,
    orderId: string,
    owner?: Prisma.ServiceOrderWhereInput,
    actorUserId?: string,
  ) {
    const match = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      select: { providerId: true, assignedMemberId: true },
    });
    if (!match) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(
      tx,
      match.providerId,
      match.assignedMemberId,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
    );
    const current = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      include: orderInclude,
    });
    if (current && actorUserId)
      await assertAssignedMemberActive(tx, current, actorUserId);
    if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return current;
  }
}
