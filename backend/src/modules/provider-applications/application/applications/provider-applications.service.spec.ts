import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ProviderApplicationSection,
  ProviderApplicationStatus,
  ProviderDocumentType,
  ProviderType,
  ReviewStatus,
  ServiceStatus,
} from '@prisma/client';
import { CURRENT_PROVIDER_TERMS_VERSION } from '../../constants/provider-terms.constants';
import { ProviderApplicationsService } from './provider-applications.service';
import { ProviderApplicationServicesService } from '../services/provider-application-services.service';

const applicationId = '3b3397ea-aef4-4b75-87ef-4188add96e43';
const userId = 'acb4e955-4f1d-4e6c-9dfd-c7317bba24be';
const serviceId = 'e3f91ad7-4b0e-458a-b98f-719d71006021';

function createContext() {
  const checks = Object.values(ProviderApplicationSection).map((section) => ({
    section,
    status: ReviewStatus.PENDING,
  }));
  const baseApplication = {
    id: applicationId,
    userId,
    providerType: ProviderType.INDIVIDUAL,
    status: ProviderApplicationStatus.DRAFT,
    revisionNumber: 0,
    legalFullName: 'Nguyen Van A',
    birthDate: new Date('1995-08-20T00:00:00.000Z'),
    gender: null,
    email: 'provider@example.com',
    emailVerifiedAt: new Date(),
    biography: null,
    nationalIdNumber: null,
    nationalIdEncrypted: 'encrypted-national-id',
    experienceYears: 3,
    organizationName: null,
    taxCode: null,
    businessRegistrationNumber: null,
    registeredAddress: null,
    representativeName: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedById: null,
    decisionReason: null,
    withdrawnAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    checks,
  };
  const standardService = {
    category: { status: 'ACTIVE' },
    requiresCertificate: false,
    minPortfolioImages: 0,
    minExperienceYears: 0,
    id: serviceId,
    status: ServiceStatus.ACTIVE,
    minPriceAmount: 50_000,
    maxPriceAmount: 300_000,
  };
  const providerApplication = {
    findFirst: jest.fn().mockResolvedValue(baseApplication),
    create: jest.fn().mockResolvedValue(baseApplication),
    update: jest.fn().mockResolvedValue(baseApplication),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const providerApplicationCheck = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const providerApplicationService = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ id: 'item-id' }),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const providerApplicationDocument = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const providerApplicationRevision = {
    create: jest.fn().mockResolvedValue({ id: 'revision-id' }),
  };
  const providerApplicationTermsAcceptance = {
    upsert: jest.fn().mockResolvedValue({
      applicationId,
      termsVersion: CURRENT_PROVIDER_TERMS_VERSION,
    }),
  };
  const providerProfile = { findUnique: jest.fn().mockResolvedValue(null) };
  const service = { findFirst: jest.fn().mockResolvedValue(standardService) };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
    providerApplicationTermsAcceptance,
    service,
    providerApplication,
    providerApplicationCheck,
    providerApplicationService,
    providerApplicationDocument,
    providerApplicationRevision,
  };
  const prisma = {
    providerApplication,
    providerApplicationCheck,
    providerApplicationService,
    providerApplicationDocument,
    providerApplicationRevision,
    providerApplicationTermsAcceptance,
    providerProfile,
    service,
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (client: typeof transaction) => Promise<unknown>)(
          transaction,
        );
      }
      return Promise.all(input as Promise<unknown>[]);
    }),
  };
  const kycCrypto = {
    protectNationalId: jest.fn((value: string) => ({
      encrypted: `encrypted:${value}`,
      hash: `hash:${value}`,
      last4: value.slice(-4),
    })),
  };
  const notifications = {
    notifySubmitted: jest.fn().mockResolvedValue(undefined),
  };
  return {
    applicationServices: new ProviderApplicationServicesService(
      prisma as never,
    ),
    serviceUnderTest: new ProviderApplicationsService(
      prisma as never,
      kycCrypto as never,
      notifications as never,
    ),
    prisma,
    baseApplication,
    standardService,
    notifications,
  };
}

describe('ProviderApplicationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a proposed price outside the admin range', async () => {
    const { applicationServices } = createContext();
    await expect(
      applicationServices.add(applicationId, userId, {
        serviceId,
        proposedPriceAmount: 40_000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let a correction alter a verified section', async () => {
    const { serviceUnderTest, prisma, baseApplication } = createContext();
    prisma.providerApplication.findFirst.mockResolvedValue({
      ...baseApplication,
      status: ProviderApplicationStatus.NEEDS_CHANGES,
      checks: baseApplication.checks.map((check) => ({
        ...check,
        status:
          check.section === ProviderApplicationSection.EXPERTISE
            ? ReviewStatus.NEEDS_CHANGES
            : ReviewStatus.VERIFIED,
      })),
    });

    await expect(
      serviceUnderTest.update(applicationId, userId, {
        legalFullName: 'A different name',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports all required data before accepting a submission', async () => {
    const { serviceUnderTest, prisma, baseApplication } = createContext();
    prisma.providerApplication.findFirst.mockResolvedValue({
      ...baseApplication,
      legalFullName: null,
      documents: [],
      services: [],
      termsAcceptances: [],
    });

    await expect(
      serviceUnderTest.submit(applicationId, userId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an immutable revision and moves a complete draft to review', async () => {
    const {
      serviceUnderTest,
      prisma,
      baseApplication,
      standardService,
      notifications,
    } = createContext();
    prisma.providerApplication.findFirst.mockResolvedValue({
      ...baseApplication,
      documents: [
        ProviderDocumentType.PORTRAIT,
        ProviderDocumentType.ID_CARD_FRONT,
        ProviderDocumentType.ID_CARD_BACK,
        ProviderDocumentType.IDENTITY_SELFIE,
      ].map((type) => ({
        type,
        status: ReviewStatus.PENDING,
        deliveryType: 'authenticated',
        fileFormat: 'webp',
        fileUrl: 'https://storage.example.test/private-kyc',
        publicId: 'private-cloudinary-id',
      })),
      services: [
        {
          service: standardService,
          serviceId,
          proposedPriceAmount: 150_000,
        },
      ],
      termsAcceptances: [{ termsVersion: CURRENT_PROVIDER_TERMS_VERSION }],
    });

    const result = await serviceUnderTest.submit(applicationId, userId);

    expect(prisma.providerApplicationRevision.create).toHaveBeenCalled();
    expect(
      JSON.stringify(prisma.providerApplicationRevision.create.mock.calls),
    ).toContain('"revisionNumber":1');
    const serializedRevision = JSON.stringify(
      prisma.providerApplicationRevision.create.mock.calls,
    );
    expect(serializedRevision).not.toContain('encrypted-national-id');
    expect(serializedRevision).not.toContain('nationalIdEncrypted');
    expect(serializedRevision).not.toContain('private-cloudinary-id');
    expect(serializedRevision).not.toContain('storage.example.test');
    expect(result.data.status).toBe(ProviderApplicationStatus.PENDING_REVIEW);
    expect(notifications.notifySubmitted).toHaveBeenCalledWith(
      {
        applicationId,
        email: 'provider@example.com',
        displayName: 'Nguyen Van A',
        revisionNumber: 1,
      },
      expect.any(Object),
    );
  });
});
