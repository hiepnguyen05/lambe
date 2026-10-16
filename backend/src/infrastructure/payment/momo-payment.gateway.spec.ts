import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  MomoPaymentGateway,
  type MomoIpnPayload,
} from './momo-payment.gateway';

const values: Record<string, unknown> = {
  'momo.enabled': true,
  'momo.endpoint': 'https://test-payment.momo.vn/v2/gateway/api/create',
  'momo.partnerCode': 'partner-code',
  'momo.accessKey': 'access-key',
  'momo.secretKey': 'secret-key',
  'momo.partnerName': 'Lambe Test',
  'momo.storeId': 'LambeTestStore',
  'momo.ipnUrl': 'https://example.ngrok.app/api/payments/momo/ipn',
  'momo.redirectUrl': 'https://example.ngrok.app/api/payments/momo/return',
};

function context() {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => values[key]),
  };
  return new MomoPaymentGateway(config as never);
}

function signedIpn(): MomoIpnPayload {
  const payload = {
    partnerCode: 'partner-code',
    orderId: 'LT123',
    requestId: 'LR123',
    amount: 100000,
    orderInfo: 'Nap vi Lambe 100000 VND',
    orderType: 'momo_wallet',
    transId: 4088878653,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1721720663942,
    extraData: '',
  };
  const raw = [
    'accessKey=access-key',
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
  return {
    ...payload,
    signature: createHmac('sha256', 'secret-key').update(raw).digest('hex'),
  };
}

describe('MomoPaymentGateway', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates the official captureWallet signature and validates response identity', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          partnerCode: 'partner-code',
          orderId: 'LT123',
          requestId: 'LR123',
          amount: 100000,
          responseTime: 1,
          message: 'Successful.',
          resultCode: 0,
          payUrl: 'https://test-payment.momo.vn/pay',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const gateway = context();

    await gateway.createPayment({
      orderId: 'LT123',
      requestId: 'LR123',
      amount: 100000,
      orderInfo: 'Nap vi Lambe 100000 VND',
      extraData: '',
    });

    const rawBody = (fetchMock.mock.calls[0][1] as RequestInit).body;
    expect(typeof rawBody).toBe('string');
    const body = JSON.parse(rawBody as string) as {
      signature: string;
      secretKey?: string;
    };
    expect(body.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(body).not.toHaveProperty('secretKey');
  });

  it('accepts a correctly signed IPN and rejects a modified payload', () => {
    const gateway = context();
    const payload = signedIpn();
    expect(() => gateway.assertValidIpn(payload)).not.toThrow();
    expect(() =>
      gateway.assertValidIpn({ ...payload, amount: payload.amount + 1 }),
    ).toThrow(UnauthorizedException);
  });
});
