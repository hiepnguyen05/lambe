import { OrderWalletService } from './order-wallet.service';

describe('OrderWalletService.capture', () => {
  it('captures commission and reimburses a platform voucher atomically', async () => {
    const wallet = { id: 'wallet', balanceAmount: 100000, heldAmount: 20000 };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'wallet' }]),
      providerWallet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(wallet),
        update: jest.fn().mockResolvedValue({}),
      },
      walletHold: { update: jest.fn().mockResolvedValue({}) },
      walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const order = {
      id: 'order',
      platformFundedAmount: 30000,
      provider: { wallet },
      walletHold: { id: 'hold', amount: 20000, status: 'ACTIVE' },
    };
    await new OrderWalletService().capture(tx as never, order as never);
    expect(tx.providerWallet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'wallet' },
      data: { balanceAmount: 80000, heldAmount: 0 },
    });
    expect(tx.providerWallet.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'wallet' },
      data: { balanceAmount: 110000 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.walletTransaction.create).toHaveBeenLastCalledWith({
      data: {
        walletId: 'wallet',
        orderId: 'order',
        type: 'VOUCHER_REIMBURSEMENT',
        amount: 30000,
        balanceBeforeAmount: 80000,
        balanceAfterAmount: 110000,
        heldBeforeAmount: 0,
        heldAfterAmount: 0,
        idempotencyKey: 'order:order:voucher-reimbursement',
        reason: 'PLATFORM_VOUCHER',
      },
    });
  });
});
