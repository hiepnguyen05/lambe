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
import {
  orderInclude,
  orderViewInclude,
  presentForCustomer,
  presentForProvider,
  providerOrderViewInclude,
} from './persistence/order.presenter';
import { MINUTE } from '../domain/booking-calendar.policy';
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
      include: providerOrderViewInclude,
    });
    const page = orders.slice(0, limit);
    return {
      success: true,
      data: page.map((item) => presentForProvider(item)),
      meta: { nextCursor: orders.length > limit ? page.at(-1)?.id : null },
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
        include: orderInclude,
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
      await this.changeStatus(
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
      await transaction.orderNotification.create({
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
      return transaction.serviceOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });
    if (order.bookingAttempt > 1)
      this.metrics?.recordEvent('rematch', 'accepted');
    return {
      success: true,
      message: 'Đã nhận đơn dịch vụ.',
      data: presentForProvider(order),
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
        include: orderInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      this.assertPending(current);
      await this.calendar.release(transaction, id);
      await transaction.voucherRedemption.updateMany({
        where: { orderId: id, status: 'RESERVED' },
        data: { status: 'RELEASED' },
      });
      await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.REJECTED,
        userId,
        { rejectedAt: new Date(), rejectionReason: reason },
        reason,
      );
      await transaction.orderNotification.create({
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
      return transaction.serviceOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });
    return {
      success: true,
      message: 'Đã từ chối đơn dịch vụ.',
      data: presentForProvider(order),
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
      await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.CANCELLED,
        customerId,
        { cancelledAt: new Date() },
        dto.reason,
      );
      await transaction.orderNotification.create({
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
      return transaction.serviceOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });
    return {
      success: true,
      message: 'Đã hủy đơn dịch vụ.',
      data: asProvider ? presentForProvider(order) : presentForCustomer(order),
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
      await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.COMPLETED,
        userId,
        {
          completedAt: new Date(),
          cashCollectedAt: new Date(),
          cashCollectedByUserId: userId,
          cashCollectedAmount: current.totalAmount,
        },
      );
      await transaction.orderNotification.create({
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
      return transaction.serviceOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });
    return {
      success: true,
      message: 'Đơn đã hoàn thành và hoa hồng đã được trừ.',
      data: presentForProvider(order),
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
        include: orderInclude,
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
      await this.changeStatus(transaction, current, toStatus, userId, data);
      await transaction.orderNotification.create({
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
      return transaction.serviceOrder.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
    });
    return { success: true, message, data: presentForProvider(order) };
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
        statusHistory: {
          create: {
            fromStatus: order.status,
            toStatus,
            actorUserId,
            reason,
          },
        },
      },
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
