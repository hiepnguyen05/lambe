import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderSafetyIncidentStatus,
  OrderSafetyReason,
  Prisma,
  ServiceOrderStatus,
  WalletHoldStatus,
} from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import type {
  CloseOrderSafetyDto,
  RaiseOrderSafetyDto,
} from '../../dto/order-safety.dto';
import { OrderWalletService } from '../payments/order-wallet.service';
import { orderInclude } from '../persistence/order.presenter';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';
import {
  orderServingUserId,
  providerOrderReadWhere,
} from '../persistence/order-actor.policy';

const reportableStatuses: ServiceOrderStatus[] = [
  ServiceOrderStatus.ACCEPTED,
  ServiceOrderStatus.EN_ROUTE,
  ServiceOrderStatus.ARRIVED,
  ServiceOrderStatus.IN_PROGRESS,
];

@Injectable()
export class OrderSafetyService {
  private readonly logger = new Logger(OrderSafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BookingCalendarService,
    private readonly wallet: OrderWalletService,
    private readonly audit: AuditService,
  ) {}

  async raise(
    userId: string,
    orderId: string,
    dto: RaiseOrderSafetyDto,
    metadata: RequestMetadata,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const owned = await tx.serviceOrder.findFirst({
        where: {
          id: orderId,
          OR: [{ customerId: userId }, providerOrderReadWhere(userId)],
        },
        select: { providerId: true, assignedMemberId: true },
      });
      if (!owned) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      await this.calendar.lockProvider(
        tx,
        owned.providerId,
        owned.assignedMemberId,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
      );
      const order = await tx.serviceOrder.findFirst({
        where: {
          id: orderId,
          OR: [{ customerId: userId }, providerOrderReadWhere(userId)],
        },
        select: {
          id: true,
          customerId: true,
          assignedMemberUserId: true,
          provider: { select: { userId: true } },
          status: true,
        },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      const existing = await tx.orderSafetyIncident.findUnique({
        where: { orderId },
      });
      if (
        existing &&
        existing.status === OrderSafetyIncidentStatus.OPEN &&
        order.status === ServiceOrderStatus.SAFETY_HOLD
      ) {
        const priorReport = await tx.orderSafetyReport.findUnique({
          where: {
            incidentId_reporterId: {
              incidentId: existing.id,
              reporterId: userId,
            },
          },
        });
        if (!priorReport) {
          await tx.orderSafetyReport.create({
            data: {
              incidentId: existing.id,
              reporterId: userId,
              reason: dto.reason ?? OrderSafetyReason.THREAT,
              detail: dto.detail,
            },
          });
          await this.audit.record(
            {
              actorUserId: userId,
              action: 'ORDER_SAFETY_REPORT_ADDED',
              resourceType: 'OrderSafetyIncident',
              resourceId: existing.id,
              result: 'SUCCESS',
            },
            metadata,
            tx,
          );
        }
        return existing;
      }
      if (!reportableStatuses.includes(order.status)) {
        throw new ConflictException('Trạng thái đơn không cho phép báo SOS.');
      }
      const incident = await tx.orderSafetyIncident.create({
        data: {
          orderId,
          reports: {
            create: {
              reporterId: userId,
              reason: dto.reason ?? OrderSafetyReason.THREAT,
              detail: dto.detail,
            },
          },
        },
      });
      await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: ServiceOrderStatus.SAFETY_HOLD,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: ServiceOrderStatus.SAFETY_HOLD,
              actorUserId: userId,
              reason: 'SAFETY_SOS',
            },
          },
        },
      });
      await tx.orderCancellationRequest.updateMany({
        where: { orderId, status: 'PENDING_CUSTOMER' },
        data: { status: 'SUPPORT_REVIEW' },
      });
      await tx.orderNotification.createMany({
        data: [order.customerId, orderServingUserId(order)].map(
          (recipientId) => ({
            userId: recipientId,
            orderId,
            event: 'ORDER_SAFETY_HOLD',
          }),
        ),
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'ORDER_SAFETY_SOS',
          resourceType: 'OrderSafetyIncident',
          resourceId: incident.id,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return incident;
    });
    this.logger.warn(`Safety incident opened or updated: ${result.id}`);
    return {
      success: true,
      data: {
        id: result.id,
        orderId,
        status: result.status,
        createdAt: result.createdAt,
      },
    };
  }

  async mine(userId: string, orderId: string) {
    const incident = await this.prisma.orderSafetyIncident.findFirst({
      where: {
        orderId,
        order: { OR: [{ customerId: userId }, providerOrderReadWhere(userId)] },
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        createdAt: true,
        closedAt: true,
        reports: {
          where: { reporterId: userId },
          select: { id: true, reason: true, detail: true, createdAt: true },
        },
        evidence: {
          where: { uploadedById: userId },
          select: { id: true, createdAt: true },
        },
      },
    });
    if (!incident) throw new NotFoundException('Không tìm thấy sự cố.');
    return { success: true, data: incident };
  }

  async queue() {
    const incidents = await this.prisma.orderSafetyIncident.findMany({
      where: { status: OrderSafetyIncidentStatus.OPEN },
      select: {
        id: true,
        orderId: true,
        status: true,
        createdAt: true,
        reports: { select: { reason: true, createdAt: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    return { success: true, data: incidents };
  }

  async detail(staffId: string, incidentId: string, metadata: RequestMetadata) {
    const incident = await this.prisma.orderSafetyIncident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        orderId: true,
        status: true,
        createdAt: true,
        closedAt: true,
        resolutionNote: true,
        reports: {
          select: {
            id: true,
            reporterId: true,
            reason: true,
            detail: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        evidence: {
          select: { id: true, uploadedById: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        order: {
          select: {
            id: true,
            status: true,
            serviceName: true,
            addressLine: true,
            addressLatitude: true,
            addressLongitude: true,
            contactName: true,
            contactPhone: true,
            customerId: true,
            provider: { select: { userId: true } },
          },
        },
      },
    });
    if (!incident) throw new NotFoundException('Không tìm thấy sự cố.');
    await this.audit.record(
      {
        actorInternalAccountId: staffId,
        action: 'ORDER_SAFETY_INCIDENT_ACCESSED',
        resourceType: 'OrderSafetyIncident',
        resourceId: incidentId,
        result: 'SUCCESS',
      },
      metadata,
    );
    return { success: true, data: incident };
  }

  async close(
    staffId: string,
    incidentId: string,
    dto: CloseOrderSafetyDto,
    metadata: RequestMetadata,
  ) {
    const closed = await this.prisma.$transaction(async (tx) => {
      const target = await tx.orderSafetyIncident.findUnique({
        where: { id: incidentId },
        select: { orderId: true, order: { select: { providerId: true } } },
      });
      if (!target) throw new NotFoundException('Không tìm thấy sự cố.');
      await this.calendar.lockProvider(tx, target.order.providerId);
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${target.orderId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "order_safety_incidents" WHERE "id" = ${incidentId} FOR UPDATE`,
      );
      const incident = await tx.orderSafetyIncident.findUnique({
        where: { id: incidentId },
      });
      const order = await tx.serviceOrder.findFirst({
        where: { id: target.orderId },
        include: orderInclude,
      });
      if (
        !incident ||
        incident.status !== OrderSafetyIncidentStatus.OPEN ||
        !order ||
        order.status !== ServiceOrderStatus.SAFETY_HOLD
      ) {
        throw new ConflictException(
          'Sự cố đã được xử lý hoặc đơn đã đổi trạng thái.',
        );
      }
      if (order.walletHold?.status === WalletHoldStatus.ACTIVE) {
        await this.wallet.release(tx, order, 'SAFETY_INCIDENT_CLOSED');
      }
      await this.calendar.release(tx, order.id);
      await tx.voucherRedemption.updateMany({
        where: { orderId: order.id, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      await tx.orderCancellationRequest.updateMany({
        where: {
          orderId: order.id,
          status: { in: ['PENDING_CUSTOMER', 'SUPPORT_REVIEW'] },
        },
        data: { status: 'APPROVED', decidedAt: new Date() },
      });
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: ServiceOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: ServiceOrderStatus.SAFETY_HOLD,
              toStatus: ServiceOrderStatus.CANCELLED,
              reason: 'SAFETY_INCIDENT_CLOSED',
            },
          },
        },
      });
      const result = await tx.orderSafetyIncident.update({
        where: { id: incidentId },
        data: {
          status: OrderSafetyIncidentStatus.CLOSED,
          closedAt: new Date(),
          closedById: staffId,
          resolutionNote: dto.resolutionNote,
        },
      });
      await tx.orderNotification.createMany({
        data: [order.customerId, orderServingUserId(order)].map((userId) => ({
          userId,
          orderId: order.id,
          event: 'ORDER_SAFETY_CLOSED',
        })),
      });
      await this.audit.record(
        {
          actorInternalAccountId: staffId,
          action: 'ORDER_SAFETY_INCIDENT_CLOSED',
          resourceType: 'OrderSafetyIncident',
          resourceId: incidentId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return result;
    });
    return {
      success: true,
      data: {
        id: closed.id,
        orderId: closed.orderId,
        status: closed.status,
        closedAt: closed.closedAt,
      },
    };
  }
}
