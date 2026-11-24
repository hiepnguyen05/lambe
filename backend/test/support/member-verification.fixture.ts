import { JwtService } from '@nestjs/jwt';
import type { InternalRole } from '@prisma/client';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';
import {
  memberTestOrganization,
  memberTestUser,
} from './provider-members.fixture';

export async function memberVerificationFixture(
  prisma: PrismaService,
  jwt: JwtService,
  organization?: Awaited<ReturnType<typeof memberTestOrganization>>,
) {
  const org = organization ?? (await memberTestOrganization(prisma, jwt));
  const worker = await memberTestUser(prisma, jwt);
  const member = await prisma.providerMember.create({
    data: {
      providerId: org.provider.id,
      userId: worker.id,
      role: 'WORKER',
      canProvideServices: true,
    },
  });
  const slug = `kyc-${randomUUID()}`;
  const category = await prisma.serviceCategory.create({
    data: {
      code: slug.replaceAll('-', '_').toUpperCase(),
      name: slug,
      normalizedName: slug,
      slug,
      status: 'ACTIVE',
    },
  });
  const catalog = await prisma.service.create({
    data: {
      categoryId: category.id,
      code: slug.replaceAll('-', '_').toUpperCase(),
      name: slug,
      normalizedName: slug,
      slug,
      status: 'ACTIVE',
      minPriceAmount: 50_000,
      maxPriceAmount: 500_000,
      requiresCertificate: true,
      minExperienceYears: 1,
      minPortfolioImages: 1,
    },
  });
  const offering = await prisma.providerService.create({
    data: {
      providerId: org.provider.id,
      serviceId: catalog.id,
      sourceApplicationId: org.provider.sourceApplicationId,
      priceAmount: 150_000,
      status: 'ACTIVE',
    },
  });
  const nationalIdNumber = randomInt(0, 1_000_000_000_000)
    .toString()
    .padStart(12, '0');
  return {
    ...org,
    worker,
    member,
    offering,
    catalog,
    category,
    body: {
      legalFullName: 'Nguyễn Văn An',
      birthDate: '1995-08-20',
      gender: 'MALE',
      nationalIdNumber,
      experienceYears: 3,
      requestedProviderServiceIds: [offering.id],
      termsVersion: 'member-2026-10-27',
      acceptedTerms: true,
    },
  };
}

export async function memberTestReviewer(
  prisma: PrismaService,
  jwt: JwtService,
  role: InternalRole,
) {
  const username = `member-review-${randomUUID()}`;
  const account = await prisma.internalAccount.create({
    data: {
      username,
      normalizedUsername: username,
      fullName: 'Member verification reviewer',
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: { create: { role } },
    },
  });
  const session = await prisma.internalSession.create({
    data: {
      accountId: account.id,
      refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return {
    account,
    token: jwt.sign({
      sub: account.id,
      sessionId: session.id,
      tokenVersion: account.tokenVersion,
      purpose: 'internal_access',
    }),
  };
}

export async function memberTestOrder(
  prisma: PrismaService,
  f: Awaited<ReturnType<typeof memberVerificationFixture>>,
) {
  return prisma.serviceOrder.create({
    data: {
      customerId: f.worker.id,
      providerId: f.provider.id,
      providerServiceId: f.offering.id,
      bookingType: 'SCHEDULED',
      expectedStartAt: new Date(Date.now() + 86_400_000),
      expectedEndAt: new Date(Date.now() + 90_000_000),
      status: 'ACCEPTED',
      serviceName: 'KYC test service',
      servicePriceAmount: 150_000,
      totalAmount: 150_000,
      durationMinutes: 60,
      commissionRateBps: 2000,
      commissionAmount: 30_000,
      addressLabel: 'Test',
      addressLine: 'Test address',
      addressLatitude: 21.028,
      addressLongitude: 105.854,
      providerResponseDeadlineAt: new Date(Date.now() + 600_000),
    },
  });
}
