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
      const current = await this.lockAndLoad(tx, orderId, {
        provider: { userId },
      });
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
      const current = await this.lockAndLoad(tx, orderId, {
        provider: { userId },
      });
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
        data: { orderId, reason: dto.reason, detail: dto.detail },
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
      if (
        current.cancellationRequest?.status !==
        OrderCancellationStatus.PENDING_CUSTOMER
      )
        throw new ConflictException(
          'Không có yêu cầu hủy đang chờ khách xử lý.',
        );
      if (!activeStatuses.includes(current.status))
        throw new ConflictException('Đơn đã đổi trạng thái.');
      if (dto.approve) {
        await this.approve(tx, current, userId);
      } else {
        await tx.orderCancellationRequest.update({
          where: { orderId },
          data: {
            status: OrderCancellationStatus.SUPPORT_REVIEW,
            decisionNote: dto.note,
          },
        });
      }
      await tx.orderNotification.create({
        data: {
          userId: current.provider.userId,
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
      where: { status: OrderCancellationStatus.SUPPORT_REVIEW },
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
        data: [current.customerId, current.provider.userId].map((userId) => ({
          userId,
          orderId,
          event: dto.approve ? 'CANCELLATION_APPROVED' : 'CANCELLATION_DENIED',
        })),
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
    owner?: { customerId: string } | { provider: { userId: string } },
  ) {
    const match = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      select: { providerId: true },
    });
    if (!match) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(tx, match.providerId);
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
    );
    const current = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      include: orderInclude,
    });
    if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return current;
  }
}
