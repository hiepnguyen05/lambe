import { Prisma } from '@prisma/client';

export const serviceSummarySelect = {
  id: true,
  code: true,
  name: true,
  minPriceAmount: true,
  maxPriceAmount: true,
  currencyCode: true,
  status: true,
  targetAudience: true,
  requiresCertificate: true,
  minPortfolioImages: true,
  minExperienceYears: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ServiceSelect;

const reviewerSelect = {
  id: true,
  username: true,
  fullName: true,
} satisfies Prisma.InternalAccountSelect;

export const internalProviderApplicationDetailInclude = {
  user: { select: { id: true, phone: true, fullName: true, status: true } },
  checks: {
    orderBy: { section: 'asc' as const },
    include: { reviewedBy: { select: reviewerSelect } },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      applicationServiceId: true,
      type: true,
      isPublicCandidate: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      reviewedBy: { select: reviewerSelect },
    },
  },
  services: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      service: { select: serviceSummarySelect },
      reviewedBy: { select: reviewerSelect },
    },
  },
  termsAcceptances: { orderBy: { acceptedAt: 'desc' as const } },
  reviewedBy: { select: reviewerSelect },
} satisfies Prisma.ProviderApplicationInclude;

export const applicantProviderApplicationSelect = {
  id: true,
  userId: true,
  providerType: true,
  status: true,
  revisionNumber: true,
  legalFullName: true,
  birthDate: true,
  gender: true,
  email: true,
  emailVerifiedAt: true,
  biography: true,
  nationalIdLast4: true,
  experienceYears: true,
  organizationName: true,
  taxCode: true,
  businessRegistrationNumber: true,
  registeredAddress: true,
  representativeName: true,
  submittedAt: true,
  reviewedAt: true,
  decisionReason: true,
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, phone: true, fullName: true, status: true } },
  checks: {
    orderBy: { section: 'asc' as const },
    select: {
      id: true,
      section: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      updatedAt: true,
    },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      applicationServiceId: true,
      type: true,
      isPublicCandidate: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  services: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      serviceId: true,
      proposedPriceAmount: true,
      durationMinutes: true,
      description: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      service: { select: serviceSummarySelect },
    },
  },
  termsAcceptances: {
    orderBy: { acceptedAt: 'desc' as const },
    select: { id: true, termsVersion: true, acceptedAt: true },
  },
} satisfies Prisma.ProviderApplicationSelect;

export const providerApplicationListSelect = {
  id: true,
  providerType: true,
  status: true,
  legalFullName: true,
  organizationName: true,
  revisionNumber: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, phone: true, fullName: true } },
  _count: { select: { documents: true, services: true } },
} satisfies Prisma.ProviderApplicationSelect;
