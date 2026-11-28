import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, WalletTransactionType, type OrderAddOn } from '@prisma/client';
import type { RequestMetadata } from '../../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../../infrastructure/persistence/postgres/prisma.service';
import { DAY, MINUTE, assessSlot } from '../../domain/booking-calendar.policy';
import type {
  CreateOrderAddOnDto,
  DecideOrderAddOnDto,
} from '../../dto/order-add-on.dto';
import { OrderNotificationRelayService } from '../notifications/order-notification-relay.service';
import {
  orderInclude,
  presentForCustomer,
} from '../persistence/order.presenter';
import { BookingCalendarService } from '../scheduling/booking-calendar.service';
import { MemberServingService } from '../../../provider-members/application/booking/member-serving.service';
import {
  assertAssignedMemberActive,
  orderServingUserId,
  servingOrderWhere,
} from '../persistence/order-actor.policy';

const RESPONSE_MINUTES = 10;
const MAX_ACCEPTED_ADD_ONS = 5;
const activeOrderStatuses = ['ARRIVED', 'IN_PROGRESS'] as const;

@Injectable()
export class OrderAddOnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: BookingCalendarService,
    private readonly audit: AuditService,
    private readonly members: MemberServingService,
    @Optional() private readonly notificationRelay?: OrderNotificationRelayService,
  ) {}

  async options(userId: string, orderId: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, ...servingOrderWhere(userId) },
      select: {
        providerId: true,
        assignedMemberId: true,
        assignedMemberVersion: true,
        assignedMemberUserId: true,
        providerServiceId: true,
        status: true,
        expectedStartAt: true,
        expectedEndAt: true,
        totalAmount: true,
        currencyCode: true,
        commissionRateBps: true,
        addressLatitude: true,
        addressLongitude: true,
        provider: { select: { workingHours: true, wallet: true } },
        calendarBlock: { select: { startAt: true, active: true } },
        cancellationRequest: { select: { status: true } },
        addOns: {
          where: { status: 'ACCEPTED' },
          select: { providerServiceId: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await assertAssignedMemberActive(this.prisma, order, userId);
    this.assertOrderCanAdd(order.status);
    const excluded = [
      order.providerServiceId,
      ...order.addOns.map((item) => item.providerServiceId),
    ];
    const services = await this.prisma.providerService.findMany({
      where: {
        providerId: order.providerId,
        id: { notIn: excluded },
        status: 'ACTIVE',
        provider: {
          status: 'ACTIVE',
          setupCompletedAt: { not: null },
          user: { status: 'ACTIVE' },
        },
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        priceAmount: true,
        durationMinutes: true,
        service: {
          select: {
            name: true,
            currencyCode: true,
            minPriceAmount: true,
            maxPriceAmount: true,
            defaultDurationMinutes: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    const now = new Date();
    const latestEnd = services.reduce(
      (end, item) =>
        Math.max(
          end,
          Math.max(order.expectedEndAt.getTime(), now.getTime()) +
            (item.durationMinutes ??
              item.service.defaultDurationMinutes ??
              60) *
              MINUTE,
        ),
      now.getTime(),
    );
    const blocks =
      (
        await this.calendar.read(
          [order.providerId],
          order.expectedStartAt,
          new Date(latestEnd + DAY),
          now,
          this.prisma,
          orderId,
          order.assignedMemberId
            ? new Map([[order.assignedMemberId, order.providerId]])
            : undefined,
        )
      ).get(order.assignedMemberId ?? order.providerId) ?? [];
    const memberContexts = order.assignedMemberId
      ? await this.members.loadMany(
          [order.assignedMemberId],
          {},
          order.expectedStartAt,
          new Date(latestEnd + DAY),
        )
      : [];
    const qualified = new Map(memberContexts.map((c) => [c.offering.id, c]));
    const pending = await this.prisma.orderAddOn.count({
      where: { orderId, status: 'PENDING', expiresAt: { gt: now } },
    });
    return {
      success: true,
      data: services.map((item) => {
        const durationMinutes =
          item.durationMinutes ?? item.service.defaultDurationMinutes ?? 60;
        const validPrice =
          item.service.currencyCode === order.currencyCode &&
          item.priceAmount >= item.service.minPriceAmount &&
          item.priceAmount <= item.service.maxPriceAmount;
        const commissionAmount = this.commission(
          item.priceAmount,
          order.commissionRateBps,
        );
        const proposedEndAt = new Date(
          Math.max(order.expectedEndAt.getTime(), now.getTime()) +
            durationMinutes * MINUTE,
        );
        const context = qualified.get(item.id);
        const qualifiedMember =
          !order.assignedMemberId ||
          (!!context && !this.members.blocker(context, proposedEndAt));
        const schedule = assessSlot({
          startAt: order.expectedStartAt,
          durationMinutes:
            (proposedEndAt.getTime() - order.expectedStartAt.getTime()) /
            MINUTE,
          reservationStartAt: order.calendarBlock?.startAt,
          point: {
            latitude: order.addressLatitude,
            longitude: order.addressLongitude,
          },
          hours: context?.hours ?? order.provider.workingHours,
          blocks: [
            ...blocks,
            ...(context?.timeOffs.map((t) => ({
              startAt: t.startAt,
              endAt: t.endAt,
            })) ?? []),
          ],
        });
        const available =
          validPrice &&
          qualifiedMember &&
          durationMinutes > 0 &&
          !pending &&
          order.addOns.length < MAX_ACCEPTED_ADD_ONS &&
          !!order.calendarBlock?.active &&
          order.cancellationRequest?.status !== 'PENDING_CUSTOMER' &&
          order.cancellationRequest?.status !== 'SUPPORT_REVIEW' &&
          !!order.provider.wallet &&
          order.provider.wallet.balanceAmount -
            order.provider.wallet.heldAmount >=
            commissionAmount &&
          schedule.available;
        return {
          providerServiceId: item.id,
          serviceName: item.service.name,
          priceAmount: item.priceAmount,
          durationMinutes,
          commissionAmount,
          proposedTotalAmount: order.totalAmount + item.priceAmount,
          proposedEndAt,
          available,
          reason: available ? null : (schedule.reason ?? 'ADD_ON_UNAVAILABLE'),
        };
      }),
    };
  }

  async propose(
    userId: string,
    orderId: string,
    dto: CreateOrderAddOnDto,
    key: string,
    metadata: RequestMetadata,
  ) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key ?? ''))
      throw new BadRequestException(
        'Cần Idempotency-Key từ 8 đến 128 ký tự chữ, số, _ hoặc -.',
      );
    const hash = createHash('sha256')
      .update(JSON.stringify([dto.providerServiceId, dto.note ?? null]))
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.lockOwnedOrder(
          tx,
          orderId,
          servingOrderWhere(userId),
          userId,
        );
        const previous = await tx.orderAddOn.findUnique({
          where: { orderId_clientRequestId: { orderId, clientRequestId: key } },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'Khóa đã dùng cho đề nghị khác.',
            });
          return { success: true, data: this.presentAddOn(previous) };
        }
        this.assertOrderCanAdd(order.status);
        this.assertNoPendingCancellation(order.cancellationRequest?.status);
        const now = new Date();
        await this.expirePending(tx, orderId, now);
        if (
          await tx.orderAddOn.count({ where: { orderId, status: 'PENDING' } })
        )
          throw new ConflictException(
            'Đơn đang chờ khách phản hồi dịch vụ phát sinh.',
          );
        if (
          (await tx.orderAddOn.count({
            where: { orderId, status: 'ACCEPTED' },
          })) >= MAX_ACCEPTED_ADD_ONS
        )
          throw new ConflictException(
            'Đơn đã đạt số dịch vụ phát sinh tối đa.',
          );
        const service = await this.loadService(
          tx,
          order.providerId,
          dto.providerServiceId,
        );
        if (service.service.currencyCode !== order.currencyCode)
          throw new ConflictException(
            'Đơn và dịch vụ thêm phải cùng loại tiền.',
          );
        await this.assertDistinctService(
          tx,
          orderId,
          order.providerServiceId,
          service.id,
        );
        const durationMinutes =
          service.durationMinutes ??
          service.service.defaultDurationMinutes ??
          60;
        const commissionAmount = this.commission(
          service.priceAmount,
          order.commissionRateBps,
        );
        const proposedEndAt = new Date(
          Math.max(order.expectedEndAt.getTime(), now.getTime()) +
            durationMinutes * MINUTE,
        );
        await this.assertExtension(tx, order, proposedEndAt, now, service.id);
        if (
          !order.provider.wallet ||
          order.provider.wallet.balanceAmount -
            order.provider.wallet.heldAmount <
            commissionAmount
        )
          throw new ConflictException(
            'Ví thợ không đủ số dư khả dụng để giữ thêm hoa hồng.',
          );
        const addOn = await tx.orderAddOn.create({
          data: {
            orderId,
            providerServiceId: service.id,
            clientRequestId: key,
            requestHash: hash,
            serviceName: service.service.name,
            priceAmount: service.priceAmount,
            durationMinutes,
            commissionAmount,
            proposedTotalAmount: order.totalAmount + service.priceAmount,
            proposedEndAt,
            note: dto.note || null,
            expiresAt: new Date(now.getTime() + RESPONSE_MINUTES * MINUTE),
          },
        });
        const notification = await tx.orderNotification.create({
          data: {
            userId: order.customerId,
            orderId,
            event: 'ORDER_ADD_ON_REQUESTED',
          },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'ORDER_ADD_ON_REQUESTED',
            resourceType: 'OrderAddOn',
            resourceId: addOn.id,
            result: 'SUCCESS',
            metadata: { providerServiceId: service.id },
          },
          metadata,
          tx,
        );
        return {
          response: { success: true, data: this.presentAddOn(addOn) },
          notification,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    ).then((result) => {
      if ('notification' in result && result.notification) {
        void this.notificationRelay?.publishNow(
          result.notification.userId,
          result.notification.id,
        );
        return result.response;
      }
      return result;
    });
  }

  async cancel(
    userId: string,
    orderId: string,
    addOnId: string,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOwnedOrder(
        tx,
        orderId,
        servingOrderWhere(userId),
        userId,
      );
      const addOn = await tx.orderAddOn.findFirst({
        where: { id: addOnId, orderId },
      });
      if (!addOn)
        throw new NotFoundException('Không tìm thấy đề nghị dịch vụ.');
      if (addOn.status === 'CANCELLED')
        return { success: true, data: this.presentAddOn(addOn) };
      if (addOn.status !== 'PENDING')
        throw new ConflictException('Đề nghị đã được xử lý.');
      const updated = await tx.orderAddOn.update({
        where: { id: addOnId },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
      const notification = await tx.orderNotification.create({
        data: {
          userId: order.customerId,
          orderId,
          event: 'ORDER_ADD_ON_CANCELLED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'ORDER_ADD_ON_CANCELLED',
          resourceType: 'OrderAddOn',
          resourceId: addOnId,
          result: 'SUCCESS',
        },
        metadata,
        tx,
      );
      return {
        response: { success: true, data: this.presentAddOn(updated) },
        notification,
      };
    }).then((result) => {
      if ('notification' in result && result.notification) {
        void this.notificationRelay?.publishNow(
          result.notification.userId,
          result.notification.id,
        );
        return result.response;
      }
      return result;
    });
  }

  async decide(
    userId: string,
    orderId: string,
    addOnId: string,
    dto: DecideOrderAddOnDto,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.lockOwnedOrder(tx, orderId, {
          customerId: userId,
        });
        const addOn = await tx.orderAddOn.findFirst({
          where: { id: addOnId, orderId },
        });
        if (!addOn)
          throw new NotFoundException('Không tìm thấy đề nghị dịch vụ.');
        if (addOn.status !== 'PENDING' || addOn.expiresAt <= new Date())
          throw new ConflictException('Đề nghị đã được xử lý hoặc hết hạn.');
        this.assertOrderCanAdd(order.status);
        this.assertNoPendingCancellation(order.cancellationRequest?.status);
        const now = new Date();
        if (dto.approve) {
          const service = await this.loadService(
            tx,
            order.providerId,
            addOn.providerServiceId,
          );
          if (service.service.currencyCode !== order.currencyCode)
            throw new ConflictException(
              'Đơn và dịch vụ thêm phải cùng loại tiền.',
            );
          if (
            service.priceAmount !== addOn.priceAmount ||
            service.service.name !== addOn.serviceName ||
            (service.durationMinutes ??
              service.service.defaultDurationMinutes ??
              60) !== addOn.durationMinutes
          )
            throw new ConflictException({
              code: 'ADD_ON_PRICE_CHANGED',
              message:
                'Giá hoặc thời lượng dịch vụ đã thay đổi. Thợ cần gửi lại đề nghị.',
            });
          await this.assertDistinctService(
            tx,
            orderId,
            order.providerServiceId,
            service.id,
          );
          const endAt = new Date(
            Math.max(order.expectedEndAt.getTime(), now.getTime()) +
              addOn.durationMinutes * MINUTE,
          );
          await this.assertExtension(tx, order, endAt, now, service.id);
          const hold = await tx.walletHold.findUnique({ where: { orderId } });
          const walletId = order.provider.wallet?.id;
          if (
            !hold ||
            hold.status !== 'ACTIVE' ||
            !walletId ||
            hold.walletId !== walletId
          )
            throw new ConflictException(
              'Khoản giữ hoa hồng của đơn không hợp lệ.',
            );
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "provider_wallets" WHERE "id" = ${walletId} FOR UPDATE`,
          );
          const wallet = await tx.providerWallet.findUniqueOrThrow({
            where: { id: walletId },
          });
          if (wallet.balanceAmount - wallet.heldAmount < addOn.commissionAmount)
            throw new ConflictException(
              'Ví thợ không đủ số dư khả dụng cho dịch vụ thêm.',
            );
          await tx.providerCalendarBlock.update({
            where: { orderId },
            data: { endAt },
          });
          await tx.providerWallet.update({
            where: { id: walletId },
            data: { heldAmount: { increment: addOn.commissionAmount } },
          });
          await tx.walletHold.update({
            where: { orderId },
            data: { amount: { increment: addOn.commissionAmount } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId,
              orderId,
              type: WalletTransactionType.HOLD,
              amount: addOn.commissionAmount,
              balanceBeforeAmount: wallet.balanceAmount,
              balanceAfterAmount: wallet.balanceAmount,
              heldBeforeAmount: wallet.heldAmount,
              heldAfterAmount: wallet.heldAmount + addOn.commissionAmount,
              idempotencyKey: `order:${orderId}:addon:${addOnId}:hold`,
              reason: 'ORDER_ADD_ON',
            },
          });
          await tx.serviceOrder.update({
            where: { id: orderId },
            data: {
              subtotalAmount: { increment: addOn.priceAmount },
              totalAmount: { increment: addOn.priceAmount },
              durationMinutes: { increment: addOn.durationMinutes },
              commissionAmount: { increment: addOn.commissionAmount },
              expectedEndAt: endAt,
            },
          });
          await tx.orderAddOn.update({
            where: { id: addOnId },
            data: {
              status: 'ACCEPTED',
              respondedAt: now,
              confirmedEndAt: endAt,
            },
          });
        } else {
          await tx.orderAddOn.update({
            where: { id: addOnId },
            data: { status: 'REJECTED', respondedAt: now },
          });
        }
        const notification = await tx.orderNotification.create({
          data: {
            userId: orderServingUserId(order),
            orderId,
            event: dto.approve
              ? 'ORDER_ADD_ON_ACCEPTED'
              : 'ORDER_ADD_ON_REJECTED',
          },
        });
        await this.audit.record(
          {
            actorUserId: userId,
            action: dto.approve
              ? 'ORDER_ADD_ON_ACCEPTED'
              : 'ORDER_ADD_ON_REJECTED',
            resourceType: 'OrderAddOn',
            resourceId: addOnId,
            result: 'SUCCESS',
          },
          metadata,
          tx,
        );
        const updated = await tx.serviceOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
        return {
          response: {
            success: true,
            data: {
              addOn: updated.addOns.find((item) => item.id === addOnId),
              order: presentForCustomer(updated),
            },
          },
          notification,
        };
      },
      { maxWait: 5000, timeout: 10000 },
    ).then((result) => {
      if ('notification' in result && result.notification) {
        void this.notificationRelay?.publishNow(
          result.notification.userId,
          result.notification.id,
        );
        return result.response;
      }
      return result;
    });
  }

  private async lockOwnedOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    owner: Prisma.ServiceOrderWhereInput,
    actorUserId?: string,
  ) {
    const found = await tx.serviceOrder.findFirst({
      where: { id: orderId, ...owner },
      select: { providerId: true, assignedMemberId: true },
    });
    if (!found) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(
      tx,
      found.providerId,
      found.assignedMemberId,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${orderId} FOR UPDATE`,
    );
    const order = await tx.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        provider: {
          select: { userId: true, wallet: true, workingHours: true },
        },
        calendarBlock: true,
        cancellationRequest: { select: { status: true } },
      },
    });
    if (actorUserId) await assertAssignedMemberActive(tx, order, actorUserId);
    return order;
  }

  private async loadService(
    tx: Prisma.TransactionClient,
    providerId: string,
    id: string,
  ) {
    const service = await tx.providerService.findFirst({
      where: {
        id,
        providerId,
        status: 'ACTIVE',
        provider: {
          status: 'ACTIVE',
          setupCompletedAt: { not: null },
          user: { status: 'ACTIVE' },
        },
        service: { status: 'ACTIVE', category: { status: 'ACTIVE' } },
      },
      include: { service: true },
    });
    if (!service)
      throw new ConflictException('Dịch vụ phát sinh không còn hoạt động.');
    if (
      service.priceAmount < service.service.minPriceAmount ||
      service.priceAmount > service.service.maxPriceAmount
    )
      throw new ConflictException('Giá dịch vụ nằm ngoài khung đã duyệt.');
    return service;
  }

  private async assertDistinctService(
    tx: Prisma.TransactionClient,
    orderId: string,
    originalId: string,
    serviceId: string,
  ) {
    if (
      serviceId === originalId ||
      (await tx.orderAddOn.count({
        where: { orderId, providerServiceId: serviceId, status: 'ACCEPTED' },
      }))
    )
      throw new ConflictException('Dịch vụ này đã có trong đơn.');
  }

  private async assertExtension(
    tx: Prisma.TransactionClient,
    order: Awaited<ReturnType<OrderAddOnsService['lockOwnedOrder']>>,
    endAt: Date,
    now: Date,
    providerServiceId: string,
  ) {
    if (!order.calendarBlock?.active)
      throw new ConflictException('Lịch của đơn không còn hiệu lực.');
    const member = order.assignedMemberId
      ? await this.members.get(
          order.assignedMemberId,
          providerServiceId,
          order.expectedStartAt,
          new Date(endAt.getTime() + DAY),
          tx,
          endAt,
        )
      : null;
    const blocks =
      (
        await this.calendar.read(
          [order.providerId],
          order.expectedStartAt,
          new Date(endAt.getTime() + DAY),
          now,
          tx,
          order.id,
          order.assignedMemberId
            ? new Map([[order.assignedMemberId, order.providerId]])
            : undefined,
        )
      ).get(order.assignedMemberId ?? order.providerId) ?? [];
    if (member)
      blocks.push(
        ...member.timeOffs.map((t) => ({ startAt: t.startAt, endAt: t.endAt })),
      );
    const assessment = assessSlot({
      startAt: order.expectedStartAt,
      durationMinutes:
        (endAt.getTime() - order.expectedStartAt.getTime()) / MINUTE,
      reservationStartAt: order.calendarBlock.startAt,
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
        message: 'Dịch vụ thêm không khớp lịch làm việc hoặc đơn kế tiếp.',
      });
  }

  private async expirePending(
    tx: Prisma.TransactionClient,
    orderId: string,
    now: Date,
  ) {
    const expired = await tx.orderAddOn.updateMany({
      where: { orderId, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', respondedAt: now },
    });
    if (expired.count) {
      const order = await tx.serviceOrder.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          customerId: true,
          assignedMemberUserId: true,
          provider: { select: { userId: true } },
        },
      });
      await tx.orderNotification.createMany({
        data: [order.customerId, orderServingUserId(order)].map((userId) => ({
          userId,
          orderId,
          event: 'ORDER_ADD_ON_EXPIRED',
        })),
      });
    }
  }

  private commission(price: number, rateBps: number) {
    return Math.ceil((price * rateBps) / 10_000);
  }

  private presentAddOn(addOn: OrderAddOn) {
    return {
      id: addOn.id,
      orderId: addOn.orderId,
      providerServiceId: addOn.providerServiceId,
      serviceName: addOn.serviceName,
      priceAmount: addOn.priceAmount,
      durationMinutes: addOn.durationMinutes,
      commissionAmount: addOn.commissionAmount,
      proposedTotalAmount: addOn.proposedTotalAmount,
      proposedEndAt: addOn.proposedEndAt,
      confirmedEndAt: addOn.confirmedEndAt,
      note: addOn.note,
      status: addOn.status,
      expiresAt: addOn.expiresAt,
      createdAt: addOn.createdAt,
      respondedAt: addOn.respondedAt,
    };
  }

  private assertOrderCanAdd(status: string) {
    if (!activeOrderStatuses.some((value) => value === status))
      throw new ConflictException(
        'Chỉ thêm dịch vụ khi thợ đã đến hoặc đang làm đơn.',
      );
  }

  private assertNoPendingCancellation(status?: string) {
    if (status === 'PENDING_CUSTOMER' || status === 'SUPPORT_REVIEW')
      throw new ConflictException('Đơn đang chờ xử lý yêu cầu hủy.');
  }
}
