import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

@Injectable()
export class ProviderNotificationSignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async flush() {
    await this.syncWallets();
    await this.syncAccounts();
  }

  private async syncWallets() {
    const rows = await this.prisma.providerWalletSignal.findMany({
      select: { walletId: true, wallet: { select: { providerId: true } } },
      orderBy: [{ updatedAt: 'asc' }, { walletId: 'asc' }],
      take: 50,
    });
    for (const row of rows)
      await this.prisma.$transaction(async (tx) => {
        // Same provider-first ordering as booking; never wait on or lock the wallet after claiming its signal.
        const provider = await tx.$queryRaw<
          {
            id: string;
            userId: string;
            status: string;
            setupCompletedAt: Date | null;
          }[]
        >(
          Prisma.sql`SELECT id,"userId",status,"setupCompletedAt" FROM provider_profiles WHERE id=${row.wallet.providerId} FOR SHARE SKIP LOCKED`,
        );
        if (!provider.length) return;
        const signal = await tx.$queryRaw<{ walletId: string }[]>(
          Prisma.sql`SELECT "walletId" FROM provider_wallet_signals WHERE "walletId"=${row.walletId} FOR UPDATE SKIP LOCKED`,
        );
        if (!signal.length) return;
        const wallet = await tx.providerWallet.findUniqueOrThrow({
          where: { id: row.walletId },
        });
        const low =
          provider[0].status === 'ACTIVE' &&
          !!provider[0].setupCompletedAt &&
          wallet.balanceAmount - wallet.heldAmount <
            this.config.get<number>(
              'provider.minReceivingBalanceAmount',
              50_000,
            );
        const open = await tx.providerOperationalNotification.findFirst({
          where: {
            providerId: provider[0].id,
            event: 'WALLET_LOW_BALANCE',
            resolvedAt: null,
          },
          select: { id: true },
        });
        if (low && !open)
          await tx.providerOperationalNotification.create({
            data: {
              providerId: provider[0].id,
              userId: provider[0].userId,
              event: 'WALLET_LOW_BALANCE',
            },
          });
        if (!low && open)
          await tx.providerOperationalNotification.update({
            where: { id: open.id },
            data: { resolvedAt: new Date(), publishedAt: null },
          });
        await tx.providerWalletSignal.delete({
          where: { walletId: row.walletId },
        });
      });
  }

  private async syncAccounts() {
    const signals = await this.prisma.providerAccountSignal.findMany({
      orderBy: [{ updatedAt: 'asc' }, { userId: 'asc' }],
      take: 50,
    });
    for (const signal of signals) {
      const candidates = await this.prisma.providerMember.findMany({
        where: {
          userId: signal.userId,
          role: 'WORKER',
          status: { not: 'LEFT' },
        },
        select: { providerId: true },
      });
      const ids = [...new Set(candidates.map((m) => m.providerId))].sort();
      await this.prisma.$transaction(async (tx) => {
        if (ids.length) {
          const locked = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM provider_profiles WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE SKIP LOCKED`,
          );
          if (locked.length !== ids.length) return;
        }
        const claimed = await tx.$queryRaw<{ userId: string }[]>(
          Prisma.sql`SELECT "userId" FROM provider_account_signals WHERE "userId"=${signal.userId} FOR UPDATE SKIP LOCKED`,
        );
        if (!claimed.length) return;
        const user = await tx.user.findUnique({
          where: { id: signal.userId },
          select: { status: true },
        });
        const members = await tx.providerMember.findMany({
          where: {
            userId: signal.userId,
            role: 'WORKER',
            status: { not: 'LEFT' },
            providerId: { in: ids },
          },
          include: { provider: { select: { userId: true } } },
        });
        for (const member of members) {
          const open = await tx.providerOperationalNotification.findFirst({
            where: {
              providerId: member.providerId,
              memberId: member.id,
              membershipVersion: member.membershipVersion,
              event: 'MEMBER_ACCOUNT_RESTRICTED',
              resolvedAt: null,
            },
          });
          if (
            user &&
            user.status !== 'ACTIVE' &&
            member.status === 'ACTIVE' &&
            !open
          )
            await tx.providerOperationalNotification.create({
              data: {
                providerId: member.providerId,
                userId: member.provider.userId,
                event: 'MEMBER_ACCOUNT_RESTRICTED',
                memberId: member.id,
                membershipVersion: member.membershipVersion,
              },
            });
          if (user?.status === 'ACTIVE' && open)
            await tx.providerOperationalNotification.update({
              where: { id: open.id },
              data: { resolvedAt: new Date(), publishedAt: null },
            });
        }
        await tx.providerAccountSignal.delete({
          where: { userId: signal.userId },
        });
      });
    }
  }
}
