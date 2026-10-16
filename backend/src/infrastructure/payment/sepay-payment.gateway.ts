import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { SePayPgClient } from 'sepay-pg-node';

export interface SePayCheckoutInput {
  invoiceNumber: string;
  amount: number;
  description: string;
  customerId: string;
  topUpId: string;
}

export type SePayCheckoutFields = Record<string, string | number>;

@Injectable()
export class SePayPaymentGateway {
  constructor(private readonly config: ConfigService) {}

  createCheckout(input: SePayCheckoutInput): {
    checkoutUrl: string;
    fields: SePayCheckoutFields;
  } {
    this.assertEnabled();
    const client = new SePayPgClient({
      env: this.environment(),
      merchant_id: this.value('sepay.merchantId'),
      secret_key: this.value('sepay.secretKey'),
    });
    const baseUrl = this.value('sepay.publicBaseUrl').replace(/\/$/, '');
    const callback = (result: 'success' | 'error' | 'cancel') =>
      `${baseUrl}/api/payments/sepay/${result}?topUpId=${encodeURIComponent(input.topUpId)}`;
    const fields = client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: input.invoiceNumber,
      order_amount: input.amount,
      currency: 'VND',
      order_description: input.description,
      customer_id: input.customerId,
      success_url: callback('success'),
      error_url: callback('error'),
      cancel_url: callback('cancel'),
      custom_data: input.topUpId,
    });
    return {
      checkoutUrl: client.checkout.initCheckoutUrl(),
      fields,
    };
  }

  assertValidIpnSecret(actual?: string): void {
    this.assertEnabled();
    const expected = Buffer.from(this.value('sepay.secretKey'), 'utf8');
    const received = Buffer.from(actual ?? '', 'utf8');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('SePay X-Secret-Key không hợp lệ.');
    }
  }

  checkoutPageUrl(topUpId: string): string {
    const baseUrl = this.value('sepay.publicBaseUrl').replace(/\/$/, '');
    return `${baseUrl}/api/payments/sepay/checkout/${encodeURIComponent(topUpId)}`;
  }

  private assertEnabled(): void {
    if (!this.config.get<boolean>('sepay.enabled', false)) {
      throw new ServiceUnavailableException('Thanh toán SePay chưa được bật.');
    }
  }

  private environment(): 'sandbox' | 'production' {
    return this.config.get<'sandbox' | 'production'>(
      'sepay.environment',
      'sandbox',
    );
  }

  private value(key: string): string {
    return this.config.getOrThrow<string>(key);
  }
}
