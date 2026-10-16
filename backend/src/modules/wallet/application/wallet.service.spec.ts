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
