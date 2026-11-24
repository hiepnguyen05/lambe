import { WalletTopUpStatus } from '@prisma/client';
import { WalletService } from './wallet.service';

function context() {
  const topUp = {
    id: 'top-up-id',
    walletId: 'wallet-id',
    amount: 100000,
    status: WalletTopUpStatus.PENDING_PAYMENT,
    orderId: 'LT123',
    requestId: 'LR123',
    orderInfo: 'Nap vi Lambe 100000 VND',
    extraData: '',
  };
  const wallet = {
    id: 'wallet-id',
    balanceAmount: 200000,
    heldAmount: 10000,
  };
  const prisma = {
    walletTopUpRequest: { findUnique: jest.fn().mockResolvedValue(topUp) },
  };
  const momo = { assertValidIpn: jest.fn(), createPayment: jest.fn() };
  const sepay = {};
  const settlement = { succeed: jest.fn(), fail: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new WalletService(
    prisma as never,
    momo as never,
    sepay as never,
    settlement as never,
    audit as never,
  );
  const payload = {
    partnerCode: 'partner-code',
    orderId: topUp.orderId,
    requestId: topUp.requestId,
    amount: topUp.amount,
    orderInfo: topUp.orderInfo,
    orderType: 'momo_wallet',
    transId: 4088878653,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1721720663942,
    extraData: topUp.extraData,
    signature: 'a'.repeat(64),
  };
  return { service, settlement, momo, topUp, payload, wallet };
}

describe('WalletService MoMo IPN', () => {
  it('credits the wallet and writes one immutable TOP_UP transaction', async () => {
    const { service, settlement, payload, topUp } = context();

    await service.processMomoIpn(payload);

    expect(settlement.succeed).toHaveBeenCalledWith({
      topUpId: topUp.id,
      provider: 'MOMO',
      externalTransactionId: String(payload.transId),
      resultMessage: payload.message,
    });
  });

  it('does not credit the wallet twice when MoMo retries the same IPN', async () => {
    const { service, settlement, payload } = context();

    await service.processMomoIpn(payload);
    await service.processMomoIpn(payload);

    expect(settlement.succeed).toHaveBeenCalledTimes(2);
  });

  it('records a failed payment without changing wallet balance', async () => {
    const { service, settlement, payload, topUp } = context();

    await service.processMomoIpn({
      ...payload,
      resultCode: 1006,
      message: 'User denied payment.',
    });

    expect(settlement.succeed).not.toHaveBeenCalled();
    expect(settlement.fail).toHaveBeenCalledWith({
      topUpId: topUp.id,
      provider: 'MOMO',
      externalTransactionId: String(payload.transId),
      resultMessage: 'User denied payment.',
    });
  });
});

describe('WalletService MoMo top-up creation', () => {
  it('persists the signed callback reference in the initial write', async () => {
    const create = jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...data, status: WalletTopUpStatus.CREATED }),
      );
    const update = jest
      .fn()
      .mockImplementation(
        ({ where, data }: { where: { id: string }; data: object }) =>
          Promise.resolve({
            id: where.id,
            amount: 100000,
            provider: 'MOMO',
            orderId: 'order-id',
            expiresAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            paidAt: null,
            momoTransId: null,
            sepayTransId: null,
            ...data,
          }),
      );
    const prisma = {
      providerProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ wallet: { id: 'wallet-id' } }),
      },
      walletTopUpRequest: { create, update },
    };
    const momo = {
      createPayment: jest.fn().mockResolvedValue({
        resultCode: 0,
        payUrl: 'https://example.com/pay',
        message: 'Successful',
      }),
    };
    const service = new WalletService(
      prisma as never,
      momo as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
    );

    await service.createMomoTopUp('provider-user', { amount: 100000 }, {});

    const calls = create.mock.calls as unknown as [
      { data: { id: string; extraData: string } },
    ][];
    const saved = calls[0][0].data;
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      JSON.parse(
        Buffer.from(saved.extraData, 'base64').toString('utf8'),
      ) as unknown,
    ).toEqual({
      topUpId: saved.id,
    });
    expect(momo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ extraData: saved.extraData }),
    );
    expect(update).toHaveBeenCalledTimes(1);
  });
});
