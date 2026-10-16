import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
  presentForCustomer,
  presentForProvider,
} from './persistence/order.presenter';
import { MINUTE } from '../domain/booking-calendar.policy';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: OrderEligibilityService,
    private readonly audit: AuditService,
    private readonly calendar: BookingCalendarService,
    private readonly payments: OrderWalletService,
    private readonly booking: OrderBookingService,
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
    const orders = await this.prisma.serviceOrder.findMany({
      where: { customerId, status: query.status },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: orderInclude,
    });
    return {
      success: true,
      data: orders.map((item) => presentForCustomer(item)),
    };
  }

  async findMineById(customerId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return { success: true, data: presentForCustomer(order) };
  }

  async findProviderOrders(userId: string, query: OrderQueryDto) {
    const provider = await this.findProvider(userId);
    const orders = await this.prisma.serviceOrder.findMany({
      where: { providerId: provider.id, status: query.status },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: orderInclude,
    });
    return {
      success: true,
      data: orders.map((item) => presentForProvider(item)),
    };
  }

  async findProviderOrder(userId: string, id: string) {
    const provider = await this.findProvider(userId);
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, providerId: provider.id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    return { success: true, data: presentForProvider(order) };
  }

  async accept(userId: string, id: string, request: RequestMetadata) {
    const provider = await this.findProvider(userId);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(transaction, id, {
        providerId: provider.id,
      });
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
    const provider = await this.findProvider(userId);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(transaction, id, {
        providerId: provider.id,
      });
      await this.lockOrder(transaction, id);
      const current = await transaction.serviceOrder.findFirst({
        where: { id, providerId: provider.id },
        include: orderInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
      this.assertPending(current);
      await this.calendar.release(transaction, id);
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
    const owner = asProvider ? await this.findProvider(customerId) : null;
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(
        transaction,
        id,
        owner ? { providerId: owner.id } : { customerId },
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
          userId: owner ? current.customerId : current.provider.userId,
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

  async markArrived(userId: string, id: string, request: RequestMetadata) {
    return this.advanceProviderOrder(
      userId,
      id,
      ServiceOrderStatus.EN_ROUTE,
      ServiceOrderStatus.ARRIVED,
      { arrivedAt: new Date() },
      'SERVICE_ORDER_ARRIVED',
      'Đã cập nhật trạng thái đã đến nơi.',
      request,
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
    const provider = await this.findProvider(userId);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(transaction, id, {
        providerId: provider.id,
      });
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
      if (!current.evidence.some((item) => item.type === 'AFTER_WORK'))
        throw new ConflictException(
          'Cần ảnh kết quả sau khi làm trước khi hoàn thành.',
        );
      await this.payments.capture(transaction, current);
      await this.calendar.release(transaction, id);
      await this.changeStatus(
        transaction,
        current,
        ServiceOrderStatus.COMPLETED,
        userId,
        { completedAt: new Date() },
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

  private async findProvider(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        setupCompletedAt: true,
        serviceRadiusKm: true,
      },
    });
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
  ) {
    const provider = await this.findProvider(userId);
    const order = await this.prisma.$transaction(async (transaction) => {
      await this.lockProviderForOrder(transaction, id, {
        providerId: provider.id,
      });
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
      const requiredEvidence =
        toStatus === ServiceOrderStatus.ARRIVED
          ? 'ARRIVAL'
          : toStatus === ServiceOrderStatus.IN_PROGRESS
            ? 'BEFORE_WORK'
            : null;
      if (
        requiredEvidence &&
        !current.evidence.some((item) => item.type === requiredEvidence)
      )
        throw new ConflictException(
          'Cần tải ảnh bằng chứng trước khi chuyển trạng thái.',
        );
      if (toStatus === ServiceOrderStatus.EN_ROUTE) {
        await this.eligibility.assertOnline(provider.id);
        await this.calendar.assertCanDepart(
          transaction,
          provider.id,
          id,
          current.expectedStartAt,
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
  ) {
    const order = await transaction.serviceOrder.findFirst({
      where: { id, ...owner },
      select: { providerId: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn dịch vụ.');
    await this.calendar.lockProvider(transaction, order.providerId);
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
