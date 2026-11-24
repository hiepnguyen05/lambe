import { randomUUID } from 'node:crypto';
import { memberVerificationFixture } from './member-verification.fixture';
import type { createMemberVerificationTestApp } from './member-verification-test-app';

export async function memberCapabilitiesFixture(
  c: Awaited<ReturnType<typeof createMemberVerificationTestApp>>,
  organization?: Parameters<typeof memberVerificationFixture>[2],
) {
  const f = await memberVerificationFixture(c.prisma, c.jwt, organization);
  const protectedIdentity = c.crypto.protectNationalId(f.body.nationalIdNumber);
  await c.prisma.providerProfile.update({
    where: { id: f.provider.id },
    data: {
      setupCompletedAt: new Date(),
      serviceAreaLatitude: 21.0285,
      serviceAreaLongitude: 105.8542,
      serviceRadiusKm: 15,
    },
  });
  await c.prisma.providerWallet.update({
    where: { providerId: f.provider.id },
    data: { balanceAmount: 200_000 },
  });
  const profile = await c.prisma.providerMemberVerification.create({
    data: {
      memberId: f.member.id,
      membershipVersion: 1,
      status: 'APPROVED',
      revisionNumber: 1,
      legalFullName: f.body.legalFullName,
      birthDate: new Date('1995-08-20T00:00:00Z'),
      gender: 'MALE',
      experienceYears: 3,
      nationalIdEncrypted: protectedIdentity.encrypted,
      nationalIdHash: protectedIdentity.hash,
      nationalIdLast4: protectedIdentity.last4,
      requestedProviderServiceIds: [f.offering.id],
      termsVersion: f.body.termsVersion,
      termsAcceptedAt: new Date(),
      documents: {
        create: (
          [
            'PORTRAIT',
            'ID_CARD_FRONT',
            'ID_CARD_BACK',
            'IDENTITY_SELFIE',
            'PROFESSIONAL_CERTIFICATE',
            'PORTFOLIO',
          ] as const
        ).map((type) => ({
          type,
          publicId: `test/member-capability/${randomUUID()}`,
          fileFormat: 'png',
          status: 'VERIFIED',
          ...(['PROFESSIONAL_CERTIFICATE', 'PORTFOLIO'].includes(type)
            ? { providerServiceId: f.offering.id }
            : {}),
        })),
      },
    },
  });
  await c.prisma.providerMember.update({
    where: { id: f.member.id },
    data: { status: 'ACTIVE' },
  });
  await c.prisma.providerMemberWorkingHour.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      memberId: f.member.id,
      membershipVersion: 1,
      dayOfWeek,
      startMinute: 0,
      endMinute: 1440,
    })),
  });
  await c.prisma.providerMemberService.create({
    data: {
      memberId: f.member.id,
      membershipVersion: 1,
      providerServiceId: f.offering.id,
    },
  });
  return { ...f, profile };
}
