import { WalletTopUpStatus } from '@prisma/client';
import { WalletTopUpSettlementService } from './wallet-top-up-settlement.service';

describe('WalletTopUpSettlementService', () => {
  it('credits a SePay top-up exactly once', async () => {
    const topUp = {
      id: 'top-up-id',
      walletId: 'wallet-id',
      provider: 'SEPAY',
      amount: 100000,
      status: WalletTopUpStatus.PENDING_PAYMENT,
    };
    const wallet = {
      id: 'wallet-id',
      balanceAmount: 200000,
      heldAmount: 10000,
    };
    const transaction = {
      $queryRaw: jest.fn(),
      walletTopUpRequest: {
        findUniqueOrThrow: jest.fn().mockImplementation(() => ({ ...topUp })),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(topUp, data);
          return Promise.resolve(topUp);
        }),
      },
      providerWallet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(wallet),
        update: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transaction) => Promise<void>) =>
          callback(transaction),
      ),
    };
    const service = new WalletTopUpSettlementService(prisma as never);

    await service.succeed({
      topUpId: topUp.id,
      provider: 'SEPAY',
      externalTransactionId: 'transaction-id',
      resultMessage: 'Captured',
    });
    await service.succeed({
      topUpId: topUp.id,
      provider: 'SEPAY',
      externalTransactionId: 'transaction-id',
      resultMessage: 'Captured',
    });

    expect(transaction.providerWallet.update).toHaveBeenCalledTimes(1);
    expect(transaction.walletTransaction.create).toHaveBeenCalledTimes(1);
    expect(transaction.walletTransaction.create).toHaveBeenCalledWith({
      data: {
        walletId: 'wallet-id',
        type: 'TOP_UP',
        amount: 100000,
        balanceBeforeAmount: 200000,
        balanceAfterAmount: 300000,
        heldBeforeAmount: 10000,
        heldAfterAmount: 10000,
        idempotencyKey: 'sepay-top-up:top-up-id',
        reason: 'SEPAY transaction transaction-id',
      },
    });
    expect(topUp.status).toBe(WalletTopUpStatus.SUCCEEDED);
  });
});
