import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  ProviderProfileStatus,
  ServiceOrderStatus,
  WalletHoldStatus,
  WalletTransactionType,
} from '@prisma/client';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { ObservabilityMetrics } from '../../../infrastructure/observability/observability-metrics.service';
import type {
  CancelOrderDto,
  CreateOrderDto,
  OrderQueryDto,
  OrderQuoteDto,
} from '../dto/order.dto';
import { OrderEligibilityService } from './order-eligibility.service';
import { BookingCalendarService } from './scheduling/booking-calendar.service';
import { OrderWalletService } from './payments/order-wallet.service';
import { OrderBookingService } from './booking/order-booking.service';
import { OrderNotificationRelayService } from './notifications/order-notification-relay.service';
import {
  orderInclude,
  orderViewInclude,
  presentForCustomer,
  presentForProvider,
  providerOrderViewInclude,
  pendingOrderInclude,
} from './persistence/order.presenter';
import { MINUTE } from '../domain/booking-calendar.policy';
import { scheduledOrderOverdueAt } from '../domain/order-time.policy';
import { calculateDistanceKm } from '../../discovery/domain/distance';
import type { OrderLocationDto } from '../dto/order-location.dto';
import {
  assertAssignedMemberActive,
  orderServingUserId,
  providerOrderReadWhere,
  servingOrderWhere,
} from './persistence/order-actor.policy';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: OrderEligibilityService,
    private readonly audit: AuditService,
    private readonly calendar: BookingCalendarService,
    private readonly payments: OrderWalletService,
    private readonly booking: OrderBookingService,
    @Optional() private readonly metrics?: ObservabilityMetrics,
    @Optional()
    private readonly notificationRelay?: OrderNotificationRelayService,
  ) {}

  quote(customerId: string, dto: OrderQuoteDto) {
    return this.booking.quote(customerId, dto);
  }

  create(
    customerId: string,
    dto: CreateOrderDto,
    request: RequestMetadata,
    idempotencyKey: string,
  ) {
    return this.booking.create(customerId, dto, request, idempotencyKey);
  }

  async findMine(customerId: string, query: OrderQueryDto) {
    const limit = query.limit ?? 50;
    const cursor = await this.resolveCursor(query.cursor, { customerId });
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        customerId,
        status: query.status,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: orderViewInclude,
    });
    const page = orders.slice(0, limit);
    return {
      success: true,
      data: page.map((item) => presentForCustomer(item)),
      meta: { nextCursor: orders.length > limit ? page.at(-1)?.id : null },
    };
  }

  async findMineById(customerId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId },
      include: orderViewInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return { success: true, data: presentForCustomer(order) };
  }

  async findProviderOrders(userId: string, query: OrderQueryDto) {
    const scope = providerOrderReadWhere(userId);
    const limit = query.limit ?? 50;
    const cursor = await this.resolveCursor(query.cursor, scope);
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        ...scope,
        status: query.status,
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include:
        query.status === ServiceOrderStatus.PENDING_PROVIDER
          ? pendingOrderInclude
          : providerOrderViewInclude,
    });
    const page = orders.slice(0, limit);
    return {
      success: true,
      data: page.map((item) => presentForProvider(item)),
      meta: { nextCursor: orders.length > limit ? page.at(-1)?.id : null },
    };
  }

  async findUpcomingProviderOrders(userId: string) {
    const data = await this.prisma.serviceOrder.findMany({
      where: {
        ...providerOrderReadWhere(userId),
        status: ServiceOrderStatus.ACCEPTED,
      },
      orderBy: [{ expectedStartAt: 'asc' }, { id: 'asc' }],
      take: 5,
      select: {
        id: true,
        bookingType: true,
        status: true,
        scheduledAt: true,
        expectedStartAt: true,
        serviceName: true,
        addressLine: true,
        addressLabel: true,
        contactName: true,
        contactPhone: true,
        totalAmount: true,
        travelDistanceKm: true,
        customer: {
          select: { id: true, fullName: true, avatarUrl: true, phone: true },
        },
      },
    });
    return {
      success: true,
      data: data.map((order) => ({
        ...order,
        scheduleOverdueAt: scheduledOrderOverdueAt(order),
      })),
    };
  }

  async findProviderOrder(userId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, ...providerOrderReadWhere(userId) },
      include: providerOrderViewInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return { success: true, data: presentForProvider(order) };
  }

  async accept(userId: string, id: string, request: RequestMetadata) {
    const provider = await this.findProvider(userId, id);
    const originOrder = await this.prisma.serviceOrder.findUniqueOrThrow({
      where: { id },
      select: {
        providerServiceId: true,
        assignedMemberId: true,
        bookingType: true,
      },
    });
    const liveOrigin = await this.eligibility.captureOrigin({
      providerServiceId: originOrder.providerServiceId,
      memberId: originOrder.assignedMemberId ?? undefined,
      bookingType: originOrder.bookingType,
    });
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        {
          providerId: provider.id,
        },
        userId,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        // Validation needs scalar snapshots and the wallet ID, not the full order view.
        include: {
          provider: { select: { wallet: { select: { id: true } } } },
        },
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      this.assertPending(current);
      if (current.providerResponseDeadlineAt <= new Date()) {
        throw new ConflictException(
          'Yêu cầu đặt dịch vụ đã hết thời gian phản hồi.',
        );
      }
      const wallet = current.provider.wallet;
      if (!wallet) throw new BadRequestException('Nhà cung cấp chưa có ví.');
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "provider_wallets" WHERE "id" = ${wallet.id} FOR UPDATE`,
      );
      const freshWallet = await transaction.providerWallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });
      if (
        !this.eligibility.canReceiveNewOrder(
          freshWallet,
          current.commissionAmount,
        )
      ) {
        throw new BadRequestException(
          'Số dư khả dụng không đủ mức tối thiểu để nhận đơn và giữ hoa hồng dự kiến.',
        );
      }
      const prepared = await this.eligibility.prepare(
        current.customerId,
        {
          providerServiceId: current.providerServiceId,
          memberId: current.assignedMemberId ?? undefined,
          customerAddressId: current.customerAddressId ?? '',
          bookingType: current.bookingType,
          scheduledAt: current.scheduledAt?.toISOString(),
        },
        transaction,
        current.id,
        {
          durationMinutes: current.durationMinutes,
          commissionAmount: current.commissionAmount,
          address: {
            id: current.customerAddressId ?? '',
            latitude: current.addressLatitude,
            longitude: current.addressLongitude,
            label: current.addressLabel,
            addressLine: current.addressLine,
            provinceName: current.addressProvinceName,
            districtName: current.addressDistrictName,
            wardName: current.addressWardName,
            streetLine: current.addressStreetLine,
            contactName: current.contactName,
            contactPhone: current.contactPhone,
            note: current.addressNote,
          },
        },
        undefined,
        liveOrigin,
      );
      this.eligibility.assertAvailable(prepared);
      await transaction.providerCalendarBlock.update({
        where: { orderId: id },
        data: {
          holdExpiresAt: null,
          startAt: prepared.reservedStartAt,
          endAt: prepared.expectedEndAt,
        },
      });

      const heldAfter = freshWallet.heldAmount + current.commissionAmount;
      await transaction.providerWallet.update({
        where: { id: freshWallet.id },
        data: { heldAmount: heldAfter },
      });
      await transaction.walletHold.create({
        data: {
          walletId: freshWallet.id,
          orderId: id,
          amount: current.commissionAmount,
        },
      });
      await transaction.walletTransaction.create({
        data: {
          walletId: freshWallet.id,
          orderId: id,
          type: WalletTransactionType.HOLD,
          amount: current.commissionAmount,
          balanceBeforeAmount: freshWallet.balanceAmount,
          balanceAfterAmount: freshWallet.balanceAmount,
          heldBeforeAmount: freshWallet.heldAmount,
          heldAfterAmount: heldAfter,
          idempotencyKey: `order:${id}:hold`,
        },
      });
      const updated = await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.ACCEPTED,
        userId,
        {
          acceptedAt: new Date(),
          expectedStartAt: prepared.serviceTime,
          expectedEndAt: prepared.expectedEndAt,
        },
      );
      const notification = await transaction.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId: id,
          event: 'ORDER_ACCEPTED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'SERVICE_ORDER_ACCEPTED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notificationId: notification.id };
    });
    if (order.order.bookingAttempt > 1)
      this.metrics?.recordEvent('rematch', 'accepted');
    void this.notificationRelay?.publishNow(
      order.order.customerId,
      order.notificationId,
    );
    return {
      success: true,
      message: 'Đã nhận đơn dịch vụ.',
      data: presentForProvider(order.order),
    };
  }

  async reject(
    userId: string,
    id: string,
    reason: string,
    request: RequestMetadata,
  ) {
    const provider = await this.findProvider(userId, id);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        {
          providerId: provider.id,
        },
        userId,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        select: {
          id: true,
          status: true,
          customerId: true,
          addressLatitude: true,
          addressLongitude: true,
          expectedStartAt: true,
          assignedMemberId: true,
          scheduledAt: true,
          cancellationRequest: { select: { status: true } },
          evidence: { select: { type: true } },
        },
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      this.assertPending(current);
      await this.calendar.release(transaction, id);
      await transaction.voucherRedemption.updateMany({
        where: { orderId: id, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      const updated = await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.REJECTED,
        userId,
        { rejectedAt: new Date(), rejectionReason: reason },
        reason,
      );
      const notification = await transaction.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId: id,
          event: 'ORDER_REJECTED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'SERVICE_ORDER_REJECTED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notificationId: notification.id };
    });
    void this.notificationRelay?.publishNow(
      order.order.customerId,
      order.notificationId,
    );
    return {
      success: true,
      message: 'Đã từ chối đơn dịch vụ.',
      data: presentForProvider(order.order),
    };
  }

  async cancel(
    customerId: string,
    id: string,
    dto: CancelOrderDto,
    request: RequestMetadata,
    asProvider = false,
  ) {
    const owner = asProvider ? await this.findProvider(customerId, id) : null;
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        owner ? { providerId: owner.id } : { customerId },
        owner ? customerId : undefined,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, ...(owner ? { providerId: owner.id } : { customerId }) },
        include: orderInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      if (
        current.status !== ServiceOrderStatus.PENDING_PROVIDER &&
        current.status !== ServiceOrderStatus.ACCEPTED
      ) {
        throw new ConflictException('Không thể hủy đơn ở trạng thái hiện tại.');
      }
      if (current.walletHold?.status === WalletHoldStatus.ACTIVE) {
        await this.payments.release(transaction, current, dto.reason);
      }
      await this.calendar.release(transaction, id);
      await transaction.voucherRedemption.updateMany({
        where: { orderId: id, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      const updated = await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.CANCELLED,
        customerId,
        { cancelledAt: new Date() },
        dto.reason,
      );
      const notification = await transaction.orderNotification.create({
        data: {
          userId: owner ? current.customerId : orderServingUserId(current),
          orderId: id,
          event: 'ORDER_CANCELLED',
        },
      });
      await this.audit.record(
        {
          actorUserId: customerId,
          action: 'SERVICE_ORDER_CANCELLED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notification };
    });
    void this.notificationRelay?.publishNow(
      order.notification.userId,
      order.notification.id,
    );
    return {
      success: true,
      message: 'Đã hủy đơn dịch vụ.',
      data: asProvider
        ? presentForProvider(order.order)
        : presentForCustomer(order.order),
    };
  }

  async markEnRoute(userId: string, id: string, request: RequestMetadata) {
    return this.advanceProviderOrder(
      userId,
      id,
      ServiceOrderStatus.ACCEPTED,
      ServiceOrderStatus.EN_ROUTE,
      { enRouteAt: new Date() },
      'SERVICE_ORDER_EN_ROUTE',
      'Đã cập nhật trạng thái đang di chuyển.',
      request,
    );
  }

  async markArrived(
    userId: string,
    id: string,
    location: OrderLocationDto,
    request: RequestMetadata,
  ) {
    const capturedAt = Date.parse(location.capturedAt);
    const now = Date.now();
    if (
      !Number.isFinite(capturedAt) ||
      capturedAt < now - 30_000 ||
      capturedAt > now + 10_000
    )
      throw new ConflictException(
        'Vị trí GPS đã cũ hoặc thời gian thiết bị không hợp lệ.',
      );
    return this.advanceProviderOrder(
      userId,
      id,
      ServiceOrderStatus.EN_ROUTE,
      ServiceOrderStatus.ARRIVED,
      {
        arrivedAt: new Date(),
        arrivalLatitude: location.latitude,
        arrivalLongitude: location.longitude,
        arrivalAccuracyMeters: location.accuracyMeters,
      },
      'SERVICE_ORDER_ARRIVED',
      'Đã cập nhật trạng thái đã đến nơi.',
      request,
      location,
    );
  }

  async start(userId: string, id: string, request: RequestMetadata) {
    return this.advanceProviderOrder(
      userId,
      id,
      ServiceOrderStatus.ARRIVED,
      ServiceOrderStatus.IN_PROGRESS,
      { startedAt: new Date() },
      'SERVICE_ORDER_STARTED',
      'Đã bắt đầu thực hiện dịch vụ.',
      request,
    );
  }

  async pauseWork(userId: string, id: string, request: RequestMetadata) {
    return this.toggleWorkPause(userId, id, true, request);
  }

  async resumeWork(userId: string, id: string, request: RequestMetadata) {
    return this.toggleWorkPause(userId, id, false, request);
  }

  private async toggleWorkPause(
    userId: string,
    id: string,
    pause: boolean,
    request: RequestMetadata,
  ) {
    const provider = await this.findProvider(userId, id);
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        { providerId: provider.id },
        userId,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        include: orderInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      if (current.status !== ServiceOrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Chỉ có thể tạm dừng hoặc tiếp tục khi đơn đang thực hiện.',
        );
      }
      this.assertNoPendingCancellation(current.cancellationRequest);
      if (pause && current.workPausedAt) {
        throw new ConflictException('Công việc đang tạm dừng.');
      }
      if (!pause && !current.workPausedAt) {
        throw new ConflictException('Công việc chưa tạm dừng.');
      }
      const now = new Date();
      const extraPausedSeconds =
        !pause && current.workPausedAt
          ? Math.max(
              0,
              Math.round(
                (now.getTime() - current.workPausedAt.getTime()) / 1000,
              ),
            )
          : 0;
      const updated = await transaction.serviceOrder.update({
        where: { id },
        data: pause
          ? { workPausedAt: now }
          : {
              workPausedAt: null,
              totalPausedSeconds:
                current.totalPausedSeconds + extraPausedSeconds,
            },
        include: orderInclude,
      });
      const notification = await transaction.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId: id,
          event: pause ? 'ORDER_WORK_PAUSED' : 'ORDER_WORK_RESUMED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: pause
            ? 'SERVICE_ORDER_WORK_PAUSED'
            : 'SERVICE_ORDER_WORK_RESUMED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notificationId: notification.id };
    });
    void this.notificationRelay?.publishNow(
      result.order.customerId,
      result.notificationId,
    );
    return {
      success: true,
      message: pause ? 'Đã tạm dừng công việc.' : 'Đã tiếp tục công việc.',
      data: presentForProvider(result.order),
    };
  }

  async complete(userId: string, id: string, request: RequestMetadata) {
    const provider = await this.findProvider(userId, id);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        {
          providerId: provider.id,
        },
        userId,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        include: orderInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      if (current.status !== ServiceOrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Chỉ có thể hoàn thành đơn đang thực hiện.',
        );
      }
      this.assertNoPendingCancellation(current.cancellationRequest);
      if (
        current.addOns.some(
          (item) => item.status === 'PENDING' && item.expiresAt > new Date(),
        )
      )
        throw new ConflictException(
          'Đơn đang chờ khách phản hồi dịch vụ phát sinh.',
        );
      if (!current.evidence.some((item) => item.type === 'AFTER_WORK'))
        throw new ConflictException(
          'Cần ảnh kết quả sau khi làm trước khi hoàn thành.',
        );
      await this.payments.capture(transaction, current);
      await transaction.voucherRedemption.updateMany({
        where: { orderId: id, status: 'RESERVED' },
        data: { status: 'REDEEMED' },
      });
      await this.calendar.release(transaction, id);
      const now = new Date();
      const finalPausedSeconds = current.workPausedAt
        ? current.totalPausedSeconds +
          Math.max(
            0,
            Math.round((now.getTime() - current.workPausedAt.getTime()) / 1000),
          )
        : current.totalPausedSeconds;
      const updated = await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.COMPLETED,
        userId,
        {
          completedAt: now,
          workPausedAt: null,
          totalPausedSeconds: finalPausedSeconds,
          cashCollectedAt: now,
          cashCollectedByUserId: userId,
          cashCollectedAmount: current.totalAmount,
        },
      );
      const notification = await transaction.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId: id,
          event: 'ORDER_COMPLETED',
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'SERVICE_ORDER_COMPLETED',
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notificationId: notification.id };
    });
    void this.notificationRelay?.publishNow(
      order.order.customerId,
      order.notificationId,
    );
    return {
      success: true,
      message: 'Đơn đã hoàn thành và hoa hồng đã được trừ.',
      data: presentForProvider(order.order),
    };
  }

  private async resolveCursor(
    cursorId: string | undefined,
    scope: Prisma.ServiceOrderWhereInput,
  ) {
    if (!cursorId) return null;
    const cursor = await this.prisma.serviceOrder.findFirst({
      where: { id: cursorId, AND: [scope] },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new BadRequestException('Cursor không hợp lệ.');
    return cursor;
  }

  private async findProvider(userId: string, orderId: string) {
    const owned = await this.prisma.serviceOrder.findFirst({
      where: { id: orderId, ...servingOrderWhere(userId) },
      select: {
        provider: {
          select: {
            id: true,
            status: true,
            setupCompletedAt: true,
            serviceRadiusKm: true,
          },
        },
      },
    });
    const provider = owned?.provider;
    if (!provider)
      throw new NotFoundException('Không tìm thấy hồ sơ nhà cung cấp.');
    if (
      provider.status !== ProviderProfileStatus.ACTIVE ||
      !provider.setupCompletedAt
    ) {
      throw new BadRequestException(
        'Hồ sơ nhà cung cấp chưa sẵn sàng nhận đơn.',
      );
    }
    return provider;
  }

  private async advanceProviderOrder(
    userId: string,
    id: string,
    fromStatus: ServiceOrderStatus,
    toStatus: ServiceOrderStatus,
    data: Prisma.ServiceOrderUpdateInput,
    action: string,
    message: string,
    request: RequestMetadata,
    arrivalLocation?: OrderLocationDto,
  ) {
    const provider = await this.findProvider(userId, id);
    if (toStatus === ServiceOrderStatus.EN_ROUTE) {
      const owned = await this.prisma.serviceOrder.findUniqueOrThrow({
        where: { id },
        select: { assignedMemberId: true },
      });
      // Receiving online is independent of an already accepted member job. Its GPS goes through order tracking.
      if (!owned.assignedMemberId)
        await this.eligibility.assertOnline(provider.id);
    }
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        {
          providerId: provider.id,
        },
        userId,
      );
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        select: {
          id: true,
          status: true,
          customerId: true,
          addressLatitude: true,
          addressLongitude: true,
          expectedStartAt: true,
          assignedMemberId: true,
          scheduledAt: true,
          cancellationRequest: { select: { status: true } },
          evidence: { select: { type: true } },
        },
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      if (current.status !== fromStatus) {
        throw new ConflictException(
          'Không thể chuyển đơn từ trạng thái hiện tại.',
        );
      }
      this.assertNoPendingCancellation(current.cancellationRequest);
      if (arrivalLocation) {
        const distanceMeters =
          calculateDistanceKm(arrivalLocation, {
            latitude: current.addressLatitude,
            longitude: current.addressLongitude,
          }) * 1000;
        if (distanceMeters > 300) {
          throw new ConflictException({
            code: 'ARRIVAL_TOO_FAR',
            message: 'Vị trí thiết bị còn cách địa chỉ khách quá 300 mét.',
          });
        }
        data.arrivalDistanceMeters = Math.round(distanceMeters);
      }
      const requiredEvidence =
        toStatus === ServiceOrderStatus.IN_PROGRESS ? 'BEFORE_WORK' : null;
      if (
        requiredEvidence &&
        !current.evidence.some((item) => item.type === requiredEvidence)
      )
        throw new ConflictException(
          'Cần tải ảnh bằng chứng trước khi chuyển trạng thái.',
        );
      if (toStatus === ServiceOrderStatus.EN_ROUTE) {
        if (
          current.scheduledAt &&
          current.scheduledAt.getTime() <= Date.now()
        ) {
          throw new ConflictException({
            code: 'APPOINTMENT_PASSED',
            message:
              'Lịch hẹn đã quá giờ. Hãy thống nhất giờ hẹn mới với khách trước khi khởi hành.',
          });
        }
        await this.calendar.assertCanDepart(
          transaction,
          provider.id,
          id,
          current.expectedStartAt,
          current.assignedMemberId,
        );
      }
      if (
        toStatus === ServiceOrderStatus.IN_PROGRESS &&
        current.scheduledAt &&
        current.scheduledAt.getTime() > Date.now() + 5 * MINUTE
      ) {
        throw new ConflictException('Chưa đến giờ bắt đầu lịch hẹn.');
      }
      const updated = await this.changeStatus(
        transaction,
        current,
        toStatus,
        userId,
        data,
      );
      const notification = await transaction.orderNotification.create({
        data: {
          userId: current.customerId,
          orderId: id,
          event: `ORDER_${toStatus}`,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action,
          resourceType: 'ServiceOrder',
          resourceId: id,
          result: 'SUCCESS',
        },
        request,
        transaction,
      );
      return { order: updated, notificationId: notification.id };
    });
    void this.notificationRelay?.publishNow(
      order.order.customerId,
      order.notificationId,
    );
    return { success: true, message, data: presentForProvider(order.order) };
  }

  private assertPending(order: { status: ServiceOrderStatus }): void {
    if (order.status !== ServiceOrderStatus.PENDING_PROVIDER) {
      throw new ConflictException('Đơn không còn ở trạng thái chờ phản hồi.');
    }
  }

  private assertNoPendingCancellation(
    request: { status: string } | null,
  ): void {
    if (
      request &&
      ['PENDING_CUSTOMER', 'SUPPORT_REVIEW'].includes(request.status)
    )
      throw new ConflictException('Đơn đang chờ xử lý yêu cầu hủy.');
  }

  private changeStatus(
    transaction: Prisma.TransactionClient,
    order: { id: string; status: ServiceOrderStatus },
    toStatus: ServiceOrderStatus,
    actorUserId: string,
    data: Prisma.ServiceOrderUpdateInput,
    reason?: string,
  ) {
    return transaction.serviceOrder.update({
      where: { id: order.id },
      data: {
        ...data,
        status: toStatus,
        ...(order.status === ServiceOrderStatus.ACCEPTED &&
        toStatus !== ServiceOrderStatus.ACCEPTED
          ? {
              rescheduleRequests: {
                updateMany: {
                  where: { status: 'PENDING' as const },
                  data: {
                    status: 'CANCELLED' as const,
                    respondedAt: new Date(),
                  },
                },
              },
            }
          : {}),
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus,
            actorUserId,
            reason,
          },
        },
      },
      include:
        order.status === ServiceOrderStatus.PENDING_PROVIDER
          ? pendingOrderInclude
          : providerOrderViewInclude,
    });
  }

  private async lockProviderForOrder(
    transaction: Prisma.TransactionClient,
    id: string,
    owner: { providerId: string } | { customerId: string },
    actorUserId?: string,
  ) {
    const order = await transaction.serviceOrder.findFirst({
      where: { id, ...owner },
      select: {
        providerId: true,
        assignedMemberId: true,
        assignedMemberVersion: true,
        assignedMemberUserId: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(
      transaction,
      order.providerId,
      order.assignedMemberId,
    );
    if (actorUserId)
      await assertAssignedMemberActive(transaction, order, actorUserId);
    await this.calendar.releaseExpired(
      transaction,
      order.providerId,
      new Date(),
    );
  }

  private lockOrder(transaction: Prisma.TransactionClient, id: string) {
    return transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "service_orders" WHERE "id" = ${id} FOR UPDATE`,
    );
  }
}
