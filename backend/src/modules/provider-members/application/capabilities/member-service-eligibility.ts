import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMemberVerificationComplete } from '../../domain/member-verification.policy';
import { memberVerificationInclude } from '../verification/member-verification.persistence';

export const memberOfferingInclude = {
  service: { include: { category: true } },
} satisfies Prisma.ProviderServiceInclude;
export type MemberOffering = Prisma.ProviderServiceGetPayload<{
  include: typeof memberOfferingInclude;
}>;

export async function memberVerificationForServing(
  tx: Prisma.TransactionClient,
  member: { id: string; membershipVersion: number },
) {
  return tx.providerMemberVerification.findUnique({
    where: {
      memberId_membershipVersion: {
        memberId: member.id,
        membershipVersion: member.membershipVersion,
      },
    },
    include: memberVerificationInclude,
  });
}

export function memberServiceBlocker(
  profile: Awaited<ReturnType<typeof memberVerificationForServing>>,
  offering: MemberOffering,
  validUntil = new Date(),
): string | null {
  if (!profile || profile.status !== 'APPROVED') return 'MEMBER_KYC_REQUIRED';
  if (!profile.requestedProviderServiceIds.includes(offering.id))
    return 'SERVICE_NOT_VERIFIED';
  if (
    offering.priceAmount < offering.service.minPriceAmount ||
    offering.priceAmount > offering.service.maxPriceAmount
  )
    return 'PRICE_OUT_OF_RANGE';
  try {
    // Check just this service: an expired certificate must not block unrelated qualified services.
    assertMemberVerificationComplete(
      { ...profile, requestedProviderServiceIds: [offering.id] },
      [offering],
      true,
      validUntil,
    );
    return null;
  } catch (error) {
    if (error instanceof BadRequestException)
      return 'SERVICE_QUALIFICATION_INVALID';
    throw error;
  }
}

export function presentMemberOffering(offering: MemberOffering) {
  return {
    providerServiceId: offering.id,
    serviceId: offering.serviceId,
    name: offering.service.name,
    priceAmount: offering.priceAmount,
    durationMinutes:
      offering.durationMinutes ?? offering.service.defaultDurationMinutes,
    status: offering.status,
    categoryId: offering.service.categoryId,
  };
}
