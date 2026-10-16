import {
  BadGatewayException,
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WalletTopUpStatus } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import {
  MomoPaymentGateway,
  type MomoIpnPayload,
} from '../../../infrastructure/payment/momo-payment.gateway';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import {
  SePayCheckoutFields,
  SePayPaymentGateway,
} from '../../../infrastructure/payment/sepay-payment.gateway';
import type { SePayIpnDto } from '../dto/sepay-ipn.dto';
import type {
  CreateMomoTopUpDto,
  WalletTopUpQueryDto,
  WalletTransactionQueryDto,
} from '../dto/wallet.dto';
import { WalletTopUpSettlementService } from './wallet-top-up-settlement.service';

const TOP_UP_EXPIRY_MINUTES = 30;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly momo: MomoPaymentGateway,
    private readonly sepay: SePayPaymentGateway,
    private readonly settlement: WalletTopUpSettlementService,
    private readonly audit: AuditService,
  ) {}

  async getWallet(userId: string) {
    const wallet = await this.findWallet(userId);
    return {
      success: true,
      data: {
        id: wallet.id,
        balanceAmount: wallet.balanceAmount,
        heldAmount: wallet.heldAmount,
        availableAmount: wallet.balanceAmount - wallet.heldAmount,
        currencyCode: wallet.currencyCode,
        updatedAt: wallet.updatedAt,
      },
    };
  }

  async getTransactions(userId: string, query: WalletTransactionQueryDto) {
    const wallet = await this.findWallet(userId);
    const data = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: query.type },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
      select: {
        id: true,
        orderId: true,
        type: true,
        amount: true,
        balanceBeforeAmount: true,
        balanceAfterAmount: true,
        heldBeforeAmount: true,
        heldAfterAmount: true,
        reason: true,
        createdAt: true,
      },
    });
    return { success: true, data };
  }

  async createMomoTopUp(
    userId: string,
    dto: CreateMomoTopUpDto,
    request: RequestMetadata,
  ) {
    const wallet = await this.findWallet(userId);
    const suffix = randomUUID().replaceAll('-', '');
    const orderId = `LT${suffix}`;
    const requestId = `LR${randomUUID().replaceAll('-', '')}`;
    const orderInfo = `Nap vi Lambe ${dto.amount} VND`;
    const expiresAt = new Date(Date.now() + TOP_UP_EXPIRY_MINUTES * 60_000);
    const created = await this.prisma.walletTopUpRequest.create({
      data: {
        walletId: wallet.id,
        amount: dto.amount,
        orderId,
        requestId,
        orderInfo,
        expiresAt,
      },
    });
    const extraData = Buffer.from(
      JSON.stringify({ topUpId: created.id }),
      'utf8',
    ).toString('base64');
    await this.prisma.walletTopUpRequest.update({
      where: { id: created.id },
      data: { extraData },
    });

    let result;
    try {
      result = await this.momo.createPayment({
        orderId,
        requestId,
        amount: dto.amount,
        orderInfo,
        extraData,
      });
    } catch (error) {
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'MOMO_TOP_UP_GATEWAY_ERROR',
          resourceType: 'WalletTopUpRequest',
          resourceId: created.id,
          result: 'FAILURE',
        },
        request,
      );
      throw error;
    }

    if (result.resultCode !== 0 || !result.payUrl) {
      await this.prisma.walletTopUpRequest.update({
        where: { id: created.id },
        data: {
          status: WalletTopUpStatus.FAILED,
          resultCode: result.resultCode,
          resultMessage: result.message,
        },
      });
      throw new BadGatewayException(
        `MoMo không thể tạo giao dịch: ${result.message}`,
      );
    }

    const topUp = await this.prisma.walletTopUpRequest.update({
      where: { id: created.id },
      data: {
        status: WalletTopUpStatus.PENDING_PAYMENT,
        payUrl: result.payUrl,
        deeplink: result.deeplink,
        qrCodeUrl: result.qrCodeUrl,
        resultCode: result.resultCode,
        resultMessage: result.message,
      },
    });
    await this.audit.record(
      {
        actorUserId: userId,
        action: 'MOMO_TOP_UP_CREATED',
        resourceType: 'WalletTopUpRequest',
        resourceId: topUp.id,
        result: 'SUCCESS',
        metadata: { amount: topUp.amount, orderId: topUp.orderId },
      },
      request,
    );
    return {
      success: true,
      message: 'Đã tạo yêu cầu nạp tiền MoMo.',
      data: this.presentTopUp(topUp),
    };
  }

  async getTopUps(userId: string, query: WalletTopUpQueryDto) {
    const wallet = await this.findWallet(userId);
    const topUps = await this.prisma.walletTopUpRequest.findMany({
      where: { walletId: wallet.id, status: query.status },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
    });
    return {
      success: true,
      data: topUps.map((item) => this.presentTopUp(item)),
    };
  }

  async createSePayTopUp(
    userId: string,
    dto: CreateMomoTopUpDto,
    request: RequestMetadata,
  ) {
    const wallet = await this.findWallet(userId);
    const suffix = randomUUID().replaceAll('-', '');
    const orderId = `LS${suffix}`;
    const requestId = `LSR${randomUUID().replaceAll('-', '')}`;
    const orderInfo = `Nap vi Lambe ${dto.amount} VND`;
    const expiresAt = new Date(Date.now() + TOP_UP_EXPIRY_MINUTES * 60_000);
    const created = await this.prisma.walletTopUpRequest.create({
      data: {
        walletId: wallet.id,
        amount: dto.amount,
        provider: 'SEPAY',
        orderId,
        requestId,
        orderInfo,
        expiresAt,
      },
    });

    const checkout = this.sepay.createCheckout({
      invoiceNumber: orderId,
      amount: dto.amount,
      description: orderInfo,
      customerId: userId,
      topUpId: created.id,
    });
    const payUrl = this.sepay.checkoutPageUrl(created.id);
    const topUp = await this.prisma.walletTopUpRequest.update({
      where: { id: created.id },
      data: {
        status: WalletTopUpStatus.PENDING_PAYMENT,
        payUrl,
        checkoutData: checkout,
      },
    });
    await this.audit.record(
      {
        actorUserId: userId,
        action: 'SEPAY_TOP_UP_CREATED',
        resourceType: 'WalletTopUpRequest',
        resourceId: topUp.id,
        result: 'SUCCESS',
        metadata: { amount: topUp.amount, orderId: topUp.orderId },
      },
      request,
    );
    return {
      success: true,
      message: 'Đã tạo yêu cầu nạp tiền SePay.',
      data: this.presentTopUp(topUp),
    };
  }

  async getTopUp(userId: string, id: string) {
    const wallet = await this.findWallet(userId);
    const topUp = await this.prisma.walletTopUpRequest.findFirst({
      where: { id, walletId: wallet.id },
    });
    if (!topUp) throw new NotFoundException('Không tìm thấy yêu cầu nạp tiền.');
    return { success: true, data: this.presentTopUp(topUp) };
  }

  async processMomoIpn(payload: MomoIpnPayload): Promise<void> {
    this.momo.assertValidIpn(payload);
    const existing = await this.prisma.walletTopUpRequest.findUnique({
      where: { orderId: payload.orderId },
    });
    if (!existing) {
      this.logger.warn(`Ignored unknown MoMo orderId ${payload.orderId}`);
      return;
    }
    if (
      existing.requestId !== payload.requestId ||
      existing.amount !== payload.amount ||
      existing.orderInfo !== payload.orderInfo ||
      existing.extraData !== payload.extraData
    ) {
      throw new BadRequestException('Dữ liệu IPN không khớp yêu cầu nạp tiền.');
    }

    if (payload.resultCode !== 0) {
      await this.settlement.fail({
        topUpId: existing.id,
        provider: 'MOMO',
        externalTransactionId:
          payload.transId > 0 ? String(payload.transId) : undefined,
        resultMessage: payload.message,
      });
      return;
    }
    await this.settlement.succeed({
      topUpId: existing.id,
      provider: 'MOMO',
      externalTransactionId: String(payload.transId),
      resultMessage: payload.message,
    });
  }

  async processSePayIpn(
    secretKey: string | undefined,
    payload: SePayIpnDto,
  ): Promise<void> {
    const existing = await this.prisma.walletTopUpRequest.findUnique({
      where: { orderId: payload.order.order_invoice_number },
    });
    if (!existing && this.isSePayDashboardTest(payload)) {
      this.logger.log('Accepted SePay dashboard IPN connectivity test.');
      return;
    }

    this.sepay.assertValidIpnSecret(secretKey);
    if (!existing || existing.provider !== 'SEPAY') {
      this.logger.warn(
        `Ignored unknown SePay invoice ${payload.order.order_invoice_number}`,
      );
      return;
    }
    const orderAmount = this.parseSePayAmount(payload.order.order_amount);
    const transactionAmount = this.parseSePayAmount(
      payload.transaction.transaction_amount,
    );
    if (
      orderAmount !== existing.amount ||
      transactionAmount !== existing.amount ||
      payload.order.order_currency !== 'VND' ||
      payload.transaction.transaction_currency !== 'VND'
    ) {
      throw new BadRequestException(
        'Dữ liệu IPN SePay không khớp yêu cầu nạp tiền.',
      );
    }

    if (payload.notification_type === 'TRANSACTION_VOID') {
      await this.settlement.fail({
        topUpId: existing.id,
        provider: 'SEPAY',
        externalTransactionId: payload.transaction.transaction_id,
        resultMessage: 'SePay transaction voided.',
      });
      return;
    }
    if (
      !['ORDER_PAID', 'PAYMENT_SUCCESS'].includes(payload.notification_type) ||
      payload.order.order_status !== 'CAPTURED' ||
      payload.transaction.transaction_status !== 'APPROVED' ||
      !['PAYMENT', 'CAPTURE'].includes(payload.transaction.transaction_type)
    ) {
      throw new BadRequestException('Trạng thái IPN SePay không hợp lệ.');
    }
    await this.settlement.succeed({
      topUpId: existing.id,
      provider: 'SEPAY',
      externalTransactionId: payload.transaction.transaction_id,
      resultMessage: 'SePay payment captured.',
    });
  }

  async getSePayCheckoutPage(id: string): Promise<{
    html: string;
    contentSecurityPolicy: string;
  }> {
    const topUp = await this.prisma.walletTopUpRequest.findFirst({
      where: { id, provider: 'SEPAY' },
    });
    if (!topUp) throw new NotFoundException('Không tìm thấy yêu cầu nạp tiền.');
    if (
      topUp.status !== WalletTopUpStatus.PENDING_PAYMENT ||
      topUp.expiresAt.getTime() <= Date.now()
    ) {
      throw new GoneException('Yêu cầu nạp tiền không còn hiệu lực.');
    }
    const checkout = topUp.checkoutData as null | {
      checkoutUrl: string;
      fields: SePayCheckoutFields;
    };
    if (!checkout?.checkoutUrl || !checkout.fields) {
      throw new BadGatewayException('Dữ liệu checkout SePay không hợp lệ.');
    }
    const nonce = randomBytes(18).toString('base64');
    const fields = Object.entries(checkout.fields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${this.escapeHtml(name)}" value="${this.escapeHtml(String(value))}">`,
      )
      .join('');
    const action = this.escapeHtml(checkout.checkoutUrl);
    return {
      contentSecurityPolicy: `default-src 'none'; form-action ${new URL(checkout.checkoutUrl).origin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      html: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chuyển đến SePay</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#134e4a}button{padding:12px 20px;border:0;background:#0f766e;color:#fff;border-radius:6px}</style></head><body><form id="sepay-checkout" method="post" action="${action}">${fields}<button type="submit">Tiếp tục thanh toán</button></form><script nonce="${nonce}">document.getElementById('sepay-checkout').submit();</script></body></html>`,
    };
  }

  private async findWallet(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { wallet: true },
    });
    if (!provider?.wallet) {
      throw new NotFoundException('Không tìm thấy ví nhà cung cấp.');
    }
    return provider.wallet;
  }

  private parseSePayAmount(value: string): number {
    if (!/^\d+(?:\.0{1,2})?$/.test(value)) {
      throw new BadRequestException('Số tiền IPN SePay không hợp lệ.');
    }
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền IPN SePay không hợp lệ.');
    }
    return amount;
  }

  private isSePayDashboardTest(payload: SePayIpnDto): boolean {
    const customData = payload.order.custom_data;
    return (
      payload.notification_type === 'PAYMENT_SUCCESS' &&
      typeof customData === 'object' &&
      customData !== null &&
      !Array.isArray(customData) &&
      Reflect.get(customData, 'test_mode') === true &&
      Reflect.get(customData, 'webhook_test') === true
    );
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] ?? character,
    );
  }

  private presentTopUp(topUp: {
    id: string;
    amount: number;
    status: WalletTopUpStatus;
    provider: string;
    orderId: string;
    payUrl: string | null;
    deeplink: string | null;
    qrCodeUrl: string | null;
    momoTransId: string | null;
    sepayTransId: string | null;
    resultCode: number | null;
    resultMessage: string | null;
    paidAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: topUp.id,
      amount: topUp.amount,
      status: topUp.status,
      provider: topUp.provider,
      orderId: topUp.orderId,
      payUrl: topUp.payUrl,
      deeplink: topUp.deeplink,
      qrCodeUrl: topUp.qrCodeUrl,
      momoTransId: topUp.momoTransId,
      sepayTransId: topUp.sepayTransId,
      resultCode: topUp.resultCode,
      resultMessage: topUp.resultMessage,
      paidAt: topUp.paidAt,
      expiresAt: topUp.expiresAt,
      createdAt: topUp.createdAt,
      updatedAt: topUp.updatedAt,
    };
  }
}
