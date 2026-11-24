import type { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';

export async function canReceiveProviderNotification(
  prisma: PrismaService,
  id: string,
  userId: string,
  minimum: number,
) {
  const notice = await prisma.providerOperationalNotification.findUnique({
    where: { id },
    include: {
      provider: {
        include: { wallet: true, user: { select: { status: true } } },
      },
    },
  });
  if (
    !notice ||
    notice.userId !== userId ||
    notice.provider.userId !== userId ||
    notice.resolvedAt ||
    notice.provider.user.status !== 'ACTIVE'
  )
    return false;
  const provider = notice.provider;
  if (notice.event === 'WALLET_LOW_BALANCE')
    return (
      provider.status === 'ACTIVE' &&
      !!provider.setupCompletedAt &&
      !!provider.wallet &&
      provider.wallet.balanceAmount - provider.wallet.heldAmount < minimum
    );
  if (notice.event === 'PROVIDER_SUSPENDED')
    return provider.status === 'SUSPENDED';
  const member = await prisma.providerMember.findFirst({
    where: {
      id: notice.memberId ?? '',
      providerId: notice.providerId,
      membershipVersion: notice.membershipVersion ?? -1,
    },
    select: { status: true, user: { select: { status: true } } },
  });
  if (!member) return false;
  if (notice.event === 'MEMBER_SUSPENDED') return member.status === 'SUSPENDED';
  if (notice.event === 'MEMBER_LEFT') return member.status === 'LEFT';
  return (
    notice.event === 'MEMBER_ACCOUNT_RESTRICTED' &&
    member.user.status !== 'ACTIVE' &&
    member.status !== 'LEFT'
  );
}
