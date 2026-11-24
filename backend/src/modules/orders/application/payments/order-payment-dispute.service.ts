import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus, WalletHoldStatus } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type { DecidePaymentDisputeDto } from '../../dto/order.dto';
import {
  orderInclude,
  presentForProvider,
} from '../persistence/order.presenter';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';
import { OrderWalletService } from './order-wallet.service';
import {
  assertAssignedMemberActive,
  orderServingUserId,
  servingOrderWhere,
} from '../persistence/order-actor.policy';

@Injectable()
export class OrderPaymentDisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BookingCalendarService,
    private readonly wallet: OrderWalletService,
    private readonly audit: AuditService,
  ) {}

  async escalateStaleOrder(
    accountId: string,
    alertId: string,
    note: string,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const alert = await tx.orderOperationalAlert.findUnique({
        where: { id: alertId },
        select: { orderId: true, type: true, status: true },
      });
      if (!alert) throw new NotFoundException('Không tìm thấy cảnh báo.');
      if (
        alert.type !== 'SERVICE_COMPLETION_OVERDUE' ||
        alert.status === 'RESOLVED'
      )
        throw new ConflictException(
          'Cảnh báo không còn phù hợp để mở tranh chấp.',
        );
      const current = await this.lockAndLoad(tx, alert.orderId);
      if (current.status !== ServiceOrderStatus.IN_PROGRESS)
        throw new ConflictException('Đơn đã đổi trạng thái.');
      if (current.walletHold?.status !== WalletHoldStatus.ACTIVE)
        throw new ConflictException('Khoản hoa hồng tạm giữ không hợp lệ.');
      if (
        current.cancellationRequest &&
        ['PENDING_CUSTOMER', 'SUPPORT_REVIEW'].includes(
          current.cancellationRequest.status,
        )
      )
        throw new ConflictException('Đơn đang chờ xử lý yêu cầu hủy.');
      await this.calendar.release(tx, current.id);
      await tx.serviceOrder.update({
        where: { id: current.id },
        data: {
          status: ServiceOrderStatus.PAYMENT_DISPUTE,
          paymentDisputeReason: 'SUPPORT_STALE_ORDER_REVIEW',
          paymentDisputeOpenedAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: current.status,
              toStatus: ServiceOrderStatus.PAYMENT_DISPUTE,
              reason: 'SUPPORT_STALE_ORDER_REVIEW',
            },
          },
        },
      });
      await tx.orderNotification.createMany({
        data: [current.customerId, orderServingUserId(current)].map(
          (userId) => ({
            userId,
            orderId: current.id,
            event: 'PAYMENT_DISPUTE_OPENED',
          }),
        ),
      });
      const closed = await tx.orderOperationalAlert.updateMany({
        where: { id: alertId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedById: accountId,
          resolutionNote: note,
        },
      });
      if (!closed.count)
        throw new ConflictException('Cảnh báo đã được người khác xử lý.');
      await this.audit.record(
        {
          actorInternalAccountId: accountId,
          action: 'ORDER_STALE_DISPUTE_OPENED',
          resourceType: 'ServiceOrder',
          resourceId: current.id,
          result: 'SUCCESS',
          metadata: { alertId, note },
        },
        request,
        tx,
      );
      return { id: current.id, status: ServiceOrderStatus.PAYMENT_DISPUTE };
    });
    return { success: true, data: result };
  }

  async open(
    userId: string,
    orderId: string,
    reason: string,
    request: RequestMetadata,
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(
        tx,
        orderId,
        servingOrderWhere(userId),
      );
      await assertAssignedMemberActive(tx, current, userId);
      if (current.status !== ServiceOrderStatus.IN_PROGRESS)
        throw new ConflictException(
          'Chỉ có thể báo chưa nhận tiền khi đang thực hiện đơn.',
        );
      if (!current.evidence.some((item) => item.type === 'AFTER_WORK'))
        throw new ConflictException(
          'Cần ảnh kết quả sau khi làm trước khi báo chưa nhận tiền.',
        );
      if (
        current.cancellationRequest &&
        ['PENDING_CUSTOMER', 'SUPPORT_REVIEW'].includes(
          current.cancellationRequest.status,
        )
      )
        throw new ConflictException('Đơn đang chờ xử lý yêu cầu hủy.');
      if (current.walletHold?.status !== WalletHoldStatus.ACTIVE)
        throw new ConflictException('Khoản hoa hồng tạm giữ không hợp lệ.');
      await this.calendar.release(tx, orderId);
      await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: ServiceOrderStatus.PAYMENT_DISPUTE,
          paymentDisputeReason: reason,
          paymentDisputeOpenedAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: current.status,
              toStatus: ServiceOrderStatus.PAYMENT_DISPUTE,
              actorUserId: userId,
              reason: 'CASH_NOT_RECEIVED',
            },
          },
        },
      });
      await tx.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId,
          event: 'PAYMENT_DISPUTE_OPENED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'ORDER_PAYMENT_DISPUTE_OPENED',
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
        },
        request,
        tx,
      );
      return tx.serviceOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
    });
    return { success: true, data: presentForProvider(order) };
  }

  async decide(
    accountId: string,
    orderId: string,
    dto: DecidePaymentDisputeDto,
    request: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoad(tx, orderId);
      if (
        current.status !== ServiceOrderStatus.PAYMENT_DISPUTE &&
        current.status !== ServiceOrderStatus.DISPUTED
      )
        throw new ConflictException(
          'Đơn không có tranh chấp thanh toán đang xử lý.',
        );
      if (current.walletHold?.status !== WalletHoldStatus.ACTIVE)
        throw new ConflictException('Khoản hoa hồng tạm giữ không hợp lệ.');
      if (
        dto.decision === 'CONFIRM_UNPAID' &&
        current.status === ServiceOrderStatus.DISPUTED
      )
        throw new ConflictException(
          'Tranh chấp đã được xác nhận chưa thanh toán.',
        );
      const toStatus =
        dto.decision === 'CONFIRM_PAID'
          ? ServiceOrderStatus.COMPLETED
          : ServiceOrderStatus.DISPUTED;
      if (toStatus === ServiceOrderStatus.COMPLETED) {
        await this.wallet.capture(tx, current);
        await tx.voucherRedemption.updateMany({
          where: { orderId, status: 'RESERVED' },
          data: { status: 'REDEEMED' },
        });
      }
      await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          paymentDisputeDecidedAt: new Date(),
          paymentDisputeDecisionNote: dto.note,
          ...(toStatus === ServiceOrderStatus.COMPLETED
            ? { completedAt: new Date() }
            : {}),
          statusHistory: {
            create: {
              fromStatus: current.status,
              toStatus,
              reason: dto.decision,
            },
          },
        },
      });
      await tx.orderNotification.createMany({
        data: [current.customerId, orderServingUserId(current)].map(
          (userId) => ({
            userId,
            orderId,
            event: `PAYMENT_DISPUTE_${dto.decision}`,
          }),
        ),
      });
      await this.audit.record(
        {
          actorInternalAccountId: accountId,
          action: `ORDER_PAYMENT_DISPUTE_${dto.decision}`,
          resourceType: 'ServiceOrder',
          resourceId: orderId,
          result: 'SUCCESS',
          metadata: { decision: dto.decision, note: dto.note },
        },
        request,
        tx,
      );
      return { id: orderId, status: toStatus };
    });
    return { success: true, data: result };
  }

  private async lockAndLoad(
    tx: Prisma.TransactionClient,
    orderId: string,
    owner?: Prisma.ServiceOrderWhereInput,
  ) {
    const target = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      select: { providerId: true, assignedMemberId: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(
      tx,
      target.providerId,
      target.assignedMemberId,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
    );
    return tx.serviceOrder.findFirstOrThrow({
      where: { id: orderId, ...owner },
      include: orderInclude,
    });
  }
}
