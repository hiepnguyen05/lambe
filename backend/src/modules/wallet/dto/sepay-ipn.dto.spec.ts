import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SePayIpnDto } from './sepay-ipn.dto';

describe('SePayIpnDto', () => {
  it('accepts the SePay dashboard test payload', async () => {
    const dto = plainToInstance(SePayIpnDto, {
      timestamp: 1791559360,
      notification_type: 'PAYMENT_SUCCESS',
      order: {
        id: 'order-id',
        order_id: 'TEST_ORDER',
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: 50000,
        order_invoice_number: 'INV-TEST',
        custom_data: { test_mode: true, webhook_test: true },
        user_agent: {},
        ip_address: '127.0.0.1',
        order_description: 'Test IPN',
      },
      transaction: {
        id: 'transaction-id',
        payment_method: 'BANK_TRANSFER',
        transaction_id: 'TEST_TXN',
        transaction_type: 'CAPTURE',
        transaction_date: '2026-10-09 20:22:40',
        transaction_status: 'APPROVED',
        transaction_amount: 50000,
        transaction_currency: 'VND',
        authentication_status: null,
        card_number: null,
        card_holder_name: null,
        card_expiry: null,
        card_funding_method: null,
        card_brand: null,
      },
      customer: null,
      agreement: null,
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toEqual([]);
    expect(dto.order.order_amount).toBe('50000');
    expect(dto.transaction.transaction_amount).toBe('50000');
  });
});
