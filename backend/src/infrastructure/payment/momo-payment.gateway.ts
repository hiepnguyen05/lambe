import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MomoPaymentRequest {
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  extraData: string;
}

export interface MomoPaymentResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

@Injectable()
export class MomoPaymentGateway {
  constructor(private readonly config: ConfigService) {}

  async createPayment(input: MomoPaymentRequest): Promise<MomoPaymentResponse> {
    this.assertEnabled();
    const partnerCode = this.value('momo.partnerCode');
    const accessKey = this.value('momo.accessKey');
    const secretKey = this.value('momo.secretKey');
    const ipnUrl = this.value('momo.ipnUrl');
    const redirectUrl = this.value('momo.redirectUrl');
    const requestType = 'captureWallet';
    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${input.amount}`,
      `extraData=${input.extraData}`,
      `ipnUrl=${ipnUrl}`,
      `orderId=${input.orderId}`,
      `orderInfo=${input.orderInfo}`,
      `partnerCode=${partnerCode}`,
      `redirectUrl=${redirectUrl}`,
      `requestId=${input.requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    let response: Response;
    try {
      response = await fetch(this.value('momo.endpoint'), {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          partnerCode,
          partnerName: this.value('momo.partnerName'),
          storeId: this.value('momo.storeId'),
          requestType,
          ipnUrl,
          redirectUrl,
          orderId: input.orderId,
          amount: input.amount,
          lang: 'vi',
          orderInfo: input.orderInfo,
          requestId: input.requestId,
          extraData: input.extraData,
          autoCapture: true,
          signature: this.sign(rawSignature, secretKey),
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      console.error('Lỗi khi fetch MoMo:', error);
      throw new ServiceUnavailableException(
        'Không thể kết nối cổng thanh toán MoMo.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(`MoMo phản hồi HTTP ${response.status}.`);
    }
    const result = (await response.json()) as MomoPaymentResponse;
    if (
      result.partnerCode !== partnerCode ||
      result.orderId !== input.orderId ||
      result.requestId !== input.requestId ||
      result.amount !== input.amount
    ) {
      throw new BadGatewayException(
        'Phản hồi MoMo không khớp yêu cầu nạp tiền.',
      );
    }
    return result;
  }

  assertValidIpn(payload: MomoIpnPayload): void {
    this.assertEnabled();
    if (payload.partnerCode !== this.value('momo.partnerCode')) {
      throw new UnauthorizedException('MoMo partnerCode không hợp lệ.');
    }
    const rawSignature = [
      `accessKey=${this.value('momo.accessKey')}`,
      `amount=${payload.amount}`,
      `extraData=${payload.extraData}`,
      `message=${payload.message}`,
      `orderId=${payload.orderId}`,
      `orderInfo=${payload.orderInfo}`,
      `orderType=${payload.orderType}`,
      `partnerCode=${payload.partnerCode}`,
      `payType=${payload.payType}`,
      `requestId=${payload.requestId}`,
      `responseTime=${payload.responseTime}`,
      `resultCode=${payload.resultCode}`,
      `transId=${payload.transId}`,
    ].join('&');
    const expected = this.sign(rawSignature, this.value('momo.secretKey'));
    const actualBuffer = Buffer.from(payload.signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Chữ ký IPN MoMo không hợp lệ.');
    }
  }

  private assertEnabled(): void {
    if (!this.config.get<boolean>('momo.enabled', false)) {
      throw new ServiceUnavailableException('Thanh toán MoMo chưa được bật.');
    }
  }

  private value(key: string): string {
    return this.config.getOrThrow<string>(key);
  }

  private sign(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }
}
