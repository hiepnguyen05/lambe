import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  WalletHoldStatus,
  WalletTransactionType,
} from '@prisma/client';
import type { OrderRecord } from '../persistence/order.presenter';
@Injectable()
export class OrderWalletService {
  private lockWallet(transaction: Prisma.TransactionClient, id: string) {
    return transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "provider_wallets" WHERE "id" = ${id} FOR UPDATE`,
    );
  }

  async release(
    transaction: Prisma.TransactionClient,
    order: OrderRecord,
    reason: string,
  ): Promise<void> {
    const hold = order.walletHold;
    const wallet = order.provider.wallet;
    if (!hold || !wallet || hold.status !== WalletHoldStatus.ACTIVE) return;
    await this.lockWallet(transaction, wallet.id);
    const freshWallet = await transaction.providerWallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });
    if (freshWallet.heldAmount < hold.amount) {
      throw new ConflictException('Số tiền đang giữ trong ví không hợp lệ.');
    }
    const heldAfter = freshWallet.heldAmount - hold.amount;
    await transaction.providerWallet.update({
      where: { id: wallet.id },
      data: { heldAmount: heldAfter },
    });
    await transaction.walletHold.update({
      where: { id: hold.id },
      data: { status: WalletHoldStatus.RELEASED, releasedAt: new Date() },
    });
    await transaction.walletTransaction.create({
      data: {
        walletId: wallet.id,
        orderId: order.id,
        type: WalletTransactionType.RELEASE,
        amount: hold.amount,
        balanceBeforeAmount: freshWallet.balanceAmount,
        balanceAfterAmount: freshWallet.balanceAmount,
        heldBeforeAmount: freshWallet.heldAmount,
        heldAfterAmount: heldAfter,
        idempotencyKey: `order:${order.id}:release`,
        reason,
      },
    });
  }

  async capture(
    transaction: Prisma.TransactionClient,
    order: OrderRecord,
  ): Promise<void> {
    const hold = order.walletHold;
    const wallet = order.provider.wallet;
    if (!hold || hold.status !== WalletHoldStatus.ACTIVE || !wallet) {
      throw new ConflictException(
        'Không tìm thấy khoản hoa hồng đang được giữ.',
      );
    }
    await this.lockWallet(transaction, wallet.id);
    const freshWallet = await transaction.providerWallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });
    if (
      freshWallet.heldAmount < hold.amount ||
      freshWallet.balanceAmount < hold.amount
    ) {
      throw new ConflictException('Số dư ví không hợp lệ để trừ hoa hồng.');
    }
    const balanceAfter = freshWallet.balanceAmount - hold.amount;
    const heldAfter = freshWallet.heldAmount - hold.amount;
    await transaction.providerWallet.update({
      where: { id: wallet.id },
      data: { balanceAmount: balanceAfter, heldAmount: heldAfter },
    });
    await transaction.walletHold.update({
      where: { id: hold.id },
      data: { status: WalletHoldStatus.CAPTURED, capturedAt: new Date() },
    });
    await transaction.walletTransaction.create({
      data: {
        walletId: wallet.id,
        orderId: order.id,
        type: WalletTransactionType.COMMISSION,
        amount: hold.amount,
        balanceBeforeAmount: freshWallet.balanceAmount,
        balanceAfterAmount: balanceAfter,
        heldBeforeAmount: freshWallet.heldAmount,
        heldAfterAmount: heldAfter,
        idempotencyKey: `order:${order.id}:commission`,
      },
    });
    if (order.platformFundedAmount > 0) {
      const reimbursedBalance = balanceAfter + order.platformFundedAmount;
      await transaction.providerWallet.update({
        where: { id: wallet.id },
        data: { balanceAmount: reimbursedBalance },
      });
      await transaction.walletTransaction.create({
        data: {
          walletId: wallet.id,
          orderId: order.id,
          type: WalletTransactionType.VOUCHER_REIMBURSEMENT,
          amount: order.platformFundedAmount,
          balanceBeforeAmount: balanceAfter,
          balanceAfterAmount: reimbursedBalance,
          heldBeforeAmount: heldAfter,
          heldAfterAmount: heldAfter,
          idempotencyKey: `order:${order.id}:voucher-reimbursement`,
          reason: 'PLATFORM_VOUCHER',
        },
      });
    }
  }
}
