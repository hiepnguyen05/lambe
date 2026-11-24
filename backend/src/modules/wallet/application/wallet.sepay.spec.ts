import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WalletTopUpStatus } from '@prisma/client';
import { WalletService } from './wallet.service';

function createContext() {
  const topUp = {
    id: 'top-up-id',
    walletId: 'wallet-id',
    provider: 'SEPAY',
    amount: 100000,
    status: WalletTopUpStatus.PENDING_PAYMENT,
    orderId: 'LS123',
  };
  const prisma = {
    walletTopUpRequest: { findUnique: jest.fn().mockResolvedValue(topUp) },
  };
  const sepay = {
    assertValidIpnSecret: jest.fn((secret?: string) => {
      if (secret !== 'secret') throw new UnauthorizedException();
    }),
  };
  const settlement = { succeed: jest.fn(), fail: jest.fn() };
  const service = new WalletService(
    prisma as never,
    {} as never,
    sepay as never,
    settlement as never,
    {} as never,
  );
  const payload = {
    timestamp: 1757058220,
    notification_type: 'ORDER_PAID' as const,
    order: {
      order_invoice_number: topUp.orderId,
      order_amount: '100000.00',
      order_currency: 'VND',
      order_status: 'CAPTURED',
    },
    transaction: {
      transaction_id: 'sepay-transaction-id',
      transaction_amount: '100000',
      transaction_currency: 'VND',
      transaction_status: 'APPROVED',
      transaction_type: 'PAYMENT',
    },
  };
  return { service, prisma, sepay, settlement, payload, topUp };
}

describe('WalletService SePay IPN', () => {
  it('accepts a dashboard connectivity test without weakening real IPN auth', async () => {
    const { service, prisma, sepay, settlement, payload } = createContext();
    prisma.walletTopUpRequest.findUnique.mockResolvedValueOnce(null);

    await service.processSePayIpn(undefined, {
      ...payload,
      notification_type: 'PAYMENT_SUCCESS',
      order: {
        ...payload.order,
        custom_data: { test_mode: true, webhook_test: true },
      },
      transaction: { ...payload.transaction, transaction_type: 'CAPTURE' },
    });

    expect(sepay.assertValidIpnSecret).not.toHaveBeenCalled();
    expect(settlement.succeed).not.toHaveBeenCalled();
    expect(settlement.fail).not.toHaveBeenCalled();
  });

  it.each(['development', 'production'])(
    'requires the secret for a dashboard-shaped payload in %s',
    async (nodeEnv) => {
      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = nodeEnv;
      try {
        const { service, prisma, sepay, settlement, payload } = createContext();
        prisma.walletTopUpRequest.findUnique.mockResolvedValueOnce(null);
        await expect(
          service.processSePayIpn(undefined, {
            ...payload,
            notification_type: 'PAYMENT_SUCCESS',
            order: {
              ...payload.order,
              custom_data: { test_mode: true, webhook_test: true },
            },
          }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(sepay.assertValidIpnSecret).toHaveBeenCalledWith(undefined);
        expect(prisma.walletTopUpRequest.findUnique).not.toHaveBeenCalled();
        expect(settlement.succeed).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    },
  );

  it('validates the secret and settles a captured payment', async () => {
    const { service, sepay, settlement, payload, topUp } = createContext();

    await service.processSePayIpn('secret', payload);

    expect(sepay.assertValidIpnSecret).toHaveBeenCalledWith('secret');
    expect(settlement.succeed).toHaveBeenCalledWith({
      topUpId: topUp.id,
      provider: 'SEPAY',
      externalTransactionId: payload.transaction.transaction_id,
      resultMessage: 'SePay payment captured.',
    });
  });

  it('rejects an amount that differs from the stored top-up', async () => {
    const { service, payload } = createContext();

    await expect(
      service.processSePayIpn('secret', {
        ...payload,
        transaction: { ...payload.transaction, transaction_amount: '99999' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a void without crediting the wallet', async () => {
    const { service, settlement, payload, topUp } = createContext();

    await service.processSePayIpn('secret', {
      ...payload,
      notification_type: 'TRANSACTION_VOID',
    });

    expect(settlement.succeed).not.toHaveBeenCalled();
    expect(settlement.fail).toHaveBeenCalledWith({
      topUpId: topUp.id,
      provider: 'SEPAY',
      externalTransactionId: payload.transaction.transaction_id,
      resultMessage: 'SePay transaction voided.',
    });
  });
});
