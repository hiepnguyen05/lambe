import type { Prisma } from '@prisma/client';
import { availableWalletBalance } from '../../../providers/domain/provider-receiving.policy';
import { fitsWorkingHours } from '../../../orders/domain/booking-calendar.policy';
import type { CapabilityMember } from '../capabilities/member-capability-access';
import {
  memberOfferingInclude,
  memberServiceBlocker,
  memberVerificationForServing,
} from '../capabilities/member-service-eligibility';

export function memberEffectiveRadius(member: CapabilityMember) {
  const organizationRadius = member.provider.serviceRadiusKm;
  if (
    organizationRadius === null ||
    organizationRadius < 1 ||
    organizationRadius > 50
  )
    return null;
  return Math.min(
    member.receivingRadiusKm ?? organizationRadius,
    organizationRadius,
  );
}

export async function memberReceivingBlocker(
  tx: Prisma.TransactionClient,
  member: CapabilityMember,
  minimumBalance: number,
  now = new Date(),
): Promise<string | null> {
  if (
    member.user.status !== 'ACTIVE' ||
    !member.user.phoneVerifiedAt ||
    member.provider.user.status !== 'ACTIVE'
  )
    return 'ACCOUNT_UNAVAILABLE';
  if (member.status !== 'ACTIVE' || !member.canProvideServices)
    return 'MEMBER_NOT_ACTIVE';
  if (member.provider.status !== 'ACTIVE') return 'ORGANIZATION_NOT_ACTIVE';
  if (!member.provider.acceptingMemberOrders) return 'ORGANIZATION_PAUSED';
  const provider = member.provider;
  if (
    !provider.setupCompletedAt ||
    provider.serviceAreaLatitude === null ||
    provider.serviceAreaLongitude === null ||
    !memberEffectiveRadius(member)
  )
    return 'ORGANIZATION_SETUP_REQUIRED';
  if (availableWalletBalance(provider.wallet) < minimumBalance)
    return 'ORGANIZATION_WALLET_BALANCE_TOO_LOW';
  const [profile, assignments, hours, timeOff, safety] = await Promise.all([
    memberVerificationForServing(tx, member),
    tx.providerMemberService.findMany({
      where: {
        memberId: member.id,
        membershipVersion: member.membershipVersion,
        enabled: true,
      },
      include: { providerService: { include: memberOfferingInclude } },
      take: 50,
    }),
    tx.providerMemberWorkingHour.findMany({
      where: {
        memberId: member.id,
        membershipVersion: member.membershipVersion,
      },
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    tx.providerMemberTimeOff.findFirst({
      where: {
        memberId: member.id,
        membershipVersion: member.membershipVersion,
        cancelledAt: null,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true },
    }),
    tx.serviceOrder.findFirst({
      where: { providerId: member.providerId, status: 'SAFETY_HOLD' },
      select: { id: true },
    }),
  ]);
  if (!profile || profile.status !== 'APPROVED') return 'MEMBER_KYC_REQUIRED';
  if (
    !assignments.some((a) => !memberServiceBlocker(profile, a.providerService))
  )
    return 'NO_QUALIFIED_MEMBER_SERVICE';
  if (!hours.length) return 'MEMBER_WORKING_HOURS_REQUIRED';
  if (!fitsWorkingHours(now, 0, hours)) return 'OUTSIDE_WORKING_HOURS';
  if (timeOff) return 'MEMBER_TIME_OFF';
  // P5C scopes incidents/orders to assigned workers. Keep organization fail-closed meanwhile.
  if (safety) return 'ORGANIZATION_SAFETY_HOLD';
  return null;
}
