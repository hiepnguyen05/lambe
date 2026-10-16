import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WalletTopUpStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

export type TopUpProvider = 'MOMO' | 'SEPAY';

@Injectable()
export class WalletTopUpSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async succeed(input: {
    topUpId: string;
    provider: TopUpProvider;
    externalTransactionId: string;
    resultMessage: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "wallet_top_up_requests" WHERE "id" = ${input.topUpId} FOR UPDATE`,
      );
      const topUp = await transaction.walletTopUpRequest.findUniqueOrThrow({
        where: { id: input.topUpId },
      });
      if (topUp.status === WalletTopUpStatus.SUCCEEDED) return;
      if (topUp.provider !== input.provider) {
        throw new Error('Top-up provider does not match settlement provider.');
      }

      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "provider_wallets" WHERE "id" = ${topUp.walletId} FOR UPDATE`,
      );
      const wallet = await transaction.providerWallet.findUniqueOrThrow({
        where: { id: topUp.walletId },
      });
      const balanceAfter = wallet.balanceAmount + topUp.amount;
      await transaction.providerWallet.update({
        where: { id: wallet.id },
        data: { balanceAmount: balanceAfter },
      });
      await transaction.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.TOP_UP,
          amount: topUp.amount,
          balanceBeforeAmount: wallet.balanceAmount,
          balanceAfterAmount: balanceAfter,
          heldBeforeAmount: wallet.heldAmount,
          heldAfterAmount: wallet.heldAmount,
          idempotencyKey: `${input.provider.toLowerCase()}-top-up:${topUp.id}`,
          reason: `${input.provider} transaction ${input.externalTransactionId}`,
        },
      });
      await transaction.walletTopUpRequest.update({
        where: { id: topUp.id },
        data: {
          status: WalletTopUpStatus.SUCCEEDED,
          resultCode: 0,
          resultMessage: input.resultMessage,
          paidAt: new Date(),
          ...(input.provider === 'MOMO'
            ? { momoTransId: input.externalTransactionId }
            : { sepayTransId: input.externalTransactionId }),
        },
      });
    });
  }

  async fail(input: {
    topUpId: string;
    provider: TopUpProvider;
    externalTransactionId?: string;
    resultMessage: string;
  }): Promise<void> {
    await this.prisma.walletTopUpRequest.updateMany({
      where: {
        id: input.topUpId,
        provider: input.provider,
        status: { not: WalletTopUpStatus.SUCCEEDED },
      },
      data: {
        status: WalletTopUpStatus.FAILED,
        resultMessage: input.resultMessage,
        ...(input.externalTransactionId
          ? input.provider === 'MOMO'
            ? { momoTransId: input.externalTransactionId }
            : { sepayTransId: input.externalTransactionId }
          : {}),
      },
    });
  }
}
