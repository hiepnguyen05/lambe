import { BadRequestException } from '@nestjs/common';
import {
  ProviderApplicationSection,
  ProviderApplicationStatus,
  ProviderDocumentType,
  ProviderType,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import { ProviderApplicationReviewService } from './provider-application-review.service';
import { CURRENT_PROVIDER_TERMS_VERSION } from '../../constants/provider-terms.constants';

const applicationId = '3b3397ea-aef4-4b75-87ef-4188add96e43';
const userId = 'acb4e955-4f1d-4e6c-9dfd-c7317bba24be';
const actorId = 'ab1dd0de-b692-4783-b8ad-c5b83408ca9c';

function createContext() {
  const checks: {
    section: ProviderApplicationSection;
    status: ReviewStatus;
  }[] = Object.values(ProviderApplicationSection).map((section) => ({
    section,
    status: ReviewStatus.VERIFIED,
  }));
  const application = {
    id: applicationId,
    userId,
    providerType: ProviderType.INDIVIDUAL,
    status: ProviderApplicationStatus.PENDING_REVIEW,
    legalFullName: 'Nguyen Van A',
    email: 'provider@example.com',
    emailVerifiedAt: new Date(),
    birthDate: new Date('1995-08-20'),
    nationalIdEncrypted: 'encrypted',
    revisionNumber: 1,
    termsAcceptances: [{ termsVersion: CURRENT_PROVIDER_TERMS_VERSION }],
    organizationName: null,
    biography: 'Experienced provider',
    experienceYears: 3,
    checks,
    documents: [
      {
        id: 'portrait-id',
        type: ProviderDocumentType.PORTRAIT,
        status: ReviewStatus.VERIFIED,
        fileUrl: 'https://example.test/portrait.webp',
        deliveryType: 'authenticated',
        fileFormat: 'webp',
      },
      ...[
        ProviderDocumentType.ID_CARD_FRONT,
        ProviderDocumentType.ID_CARD_BACK,
        ProviderDocumentType.IDENTITY_SELFIE,
      ].map((type) => ({
        id: `${type}-id`,
        type,
        status: ReviewStatus.VERIFIED,
        fileUrl: `https://example.test/${type}.webp`,
        deliveryType: 'authenticated',
        fileFormat: 'webp',
      })),
    ],
    services: [
      {
        id: 'item-id',
        service: {
          status: 'ACTIVE',
          category: { status: 'ACTIVE' },
          minPriceAmount: 50_000,
          maxPriceAmount: 300_000,
          requiresCertificate: false,
          minPortfolioImages: 0,
          minExperienceYears: 0,
        },
        serviceId: 'service-id',
        proposedPriceAmount: 150_000,
        durationMinutes: 60,
        description: null,
        status: ReviewStatus.VERIFIED,
      },
    ],
  };
  const providerApplication = {
    findUnique: jest.fn().mockResolvedValue(application),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const userRoleAssignment = { upsert: jest.fn().mockResolvedValue({}) };
  const providerProfile = {
    create: jest.fn().mockResolvedValue({
      id: 'provider-id',
      wallet: { balanceAmount: 0 },
      services: [{ serviceId: 'service-id' }],
    }),
  };
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
    providerApplication,
    userRoleAssignment,
    providerProfile,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    providerApplication,
    providerApplicationCheck: { findUnique: jest.fn(), update: jest.fn() },
    providerApplicationDocument: { updateMany: jest.fn() },
    providerApplicationService: { updateMany: jest.fn() },
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    notifyApproved: jest.fn().mockResolvedValue(undefined),
    notifyRejected: jest.fn().mockResolvedValue(undefined),
    notifyChangesRequested: jest.fn().mockResolvedValue(undefined),
  };
  return {
    review: new ProviderApplicationReviewService(
      prisma as never,
      audit as never,
      notifications as never,
    ),
    application,
    providerProfile,
    userRoleAssignment,
    notifications,
  };
}

describe('ProviderApplicationReviewService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires every review section to be verified before approval', async () => {
    const { review, application } = createContext();
    application.checks[0].status = ReviewStatus.PENDING;
    await expect(
      review.approve(applicationId, actorId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants provider role, wallet and approved services atomically', async () => {
    const { review, providerProfile, userRoleAssignment, notifications } =
      createContext();

    const result = await review.approve(applicationId, actorId, {});

    expect(userRoleAssignment.upsert).toHaveBeenCalled();
    expect(JSON.stringify(userRoleAssignment.upsert.mock.calls)).toContain(
      UserRole.PROVIDER,
    );
    expect(providerProfile.create).toHaveBeenCalled();
    expect(JSON.stringify(providerProfile.create.mock.calls)).toContain(
      '"priceAmount":150000',
    );
    expect(JSON.stringify(providerProfile.create.mock.calls)).toContain(
      '"wallet":{"create":{}}',
    );
    expect(notifications.notifyApproved).toHaveBeenCalledWith(
      {
        applicationId,
        email: 'provider@example.com',
        displayName: 'Nguyen Van A',
        revisionNumber: 1,
      },
      expect.any(Object),
    );
    expect(result.data.id).toBe('provider-id');
  });
});
