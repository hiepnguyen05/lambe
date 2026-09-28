import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  InternalRole,
  ProviderApplicationSection,
  ProviderDocumentType,
  ReviewStatus,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';
import {
  assertProviderAdult,
  parseProviderBirthDate,
} from './provider-birth-date.policy';
import { assertProviderServiceEligible } from './provider-service-eligibility.policy';
import {
  assertProviderSectionReviewAllowed,
  canReviewProviderKyc,
} from './provider-review-permissions.policy';
import { buildProviderSnapshot } from './provider-snapshot';

describe('Provider birth date policy', () => {
  it.each([
    '2000-02-30',
    '2000-13-01',
    '2000-01-01T00:00:00Z',
    'invalid',
    '2099-01-01',
  ])('rejects invalid/future dates: %s', (value) => {
    expect(() => parseProviderBirthDate(value)).toThrow(BadRequestException);
  });
  it('accepts exactly 18 years but not one day younger', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    expect(() =>
      assertProviderAdult(new Date('2008-09-28'), now),
    ).not.toThrow();
    expect(() => assertProviderAdult(new Date('2008-09-29'), now)).toThrow(
      BadRequestException,
    );
  });
  it('uses the birthday in Vietnam rather than the UTC day', () => {
    expect(() =>
      assertProviderAdult(
        new Date('2008-09-29'),
        new Date('2026-09-28T18:00:00Z'),
      ),
    ).not.toThrow();
  });
  it('does not treat a March 1 birthday as adult on February 29', () => {
    expect(() =>
      assertProviderAdult(
        new Date('2006-03-01'),
        new Date('2024-02-29T05:00:00Z'),
      ),
    ).toThrow();
  });
});

describe('Provider service eligibility', () => {
  const fixture = () => ({
    id: 'item',
    proposedPriceAmount: 100_000,
    service: {
      status: ServiceStatus.ACTIVE as ServiceStatus,
      category: {
        status: ServiceCategoryStatus.ACTIVE as ServiceCategoryStatus,
      },
      minPriceAmount: 50_000,
      maxPriceAmount: 150_000,
      requiresCertificate: false,
      minPortfolioImages: 0,
      minExperienceYears: 0,
    },
  });
  const document = (
    type: ProviderDocumentType = ProviderDocumentType.PROFESSIONAL_CERTIFICATE,
  ) => ({
    applicationServiceId: 'item',
    type,
    status: ReviewStatus.VERIFIED as ReviewStatus,
    deliveryType: 'authenticated',
    fileFormat: 'webp',
  });
  it('accepts an active service with no evidence requirements', () => {
    expect(() => assertProviderServiceEligible(fixture(), 0, [])).not.toThrow();
  });
  it.each(['service', 'category'] as const)('rejects inactive %s', (target) => {
    const item = fixture();
    if (target === 'service') item.service.status = ServiceStatus.INACTIVE;
    else item.service.category.status = ServiceCategoryStatus.ARCHIVED;
    expect(() => assertProviderServiceEligible(item, 3, [])).toThrow(
      BadRequestException,
    );
  });
  it.each([49_999, 150_001])(
    'rejects price outside the current range: %i',
    (price) => {
      expect(() =>
        assertProviderServiceEligible(
          { ...fixture(), proposedPriceAmount: price },
          3,
          [],
        ),
      ).toThrow();
    },
  );
  it.each([50_000, 150_000])('accepts floor/ceiling price: %i', (price) => {
    expect(() =>
      assertProviderServiceEligible(
        { ...fixture(), proposedPriceAmount: price },
        3,
        [],
      ),
    ).not.toThrow();
  });
  it('checks years of experience', () => {
    const item = fixture();
    item.service.minExperienceYears = 4;
    expect(() => assertProviderServiceEligible(item, 3, [])).toThrow();
  });
  it.each(['missing', 'unlinked', 'public', 'rejected', 'unverified'])(
    'rejects %s certificates during approval',
    (kind) => {
      const item = fixture();
      item.service.requiresCertificate = true;
      const doc = document();
      if (kind === 'unlinked') doc.applicationServiceId = 'another-item';
      if (kind === 'public') doc.deliveryType = 'upload';
      if (kind === 'rejected') doc.status = ReviewStatus.REJECTED;
      if (kind === 'unverified') doc.status = ReviewStatus.PENDING;
      expect(() =>
        assertProviderServiceEligible(
          item,
          3,
          kind === 'missing' ? [] : [doc],
          true,
        ),
      ).toThrow();
    },
  );
  it('allows pending evidence at submission but requires verified evidence at approval', () => {
    const item = fixture();
    item.service.requiresCertificate = true;
    const doc = { ...document(), status: ReviewStatus.PENDING };
    expect(() => assertProviderServiceEligible(item, 3, [doc])).not.toThrow();
    expect(() => assertProviderServiceEligible(item, 3, [doc], true)).toThrow();
  });
  it('counts portfolio only for the selected service', () => {
    const item = fixture();
    item.service.minPortfolioImages = 2;
    expect(() =>
      assertProviderServiceEligible(item, 3, [
        document(ProviderDocumentType.PORTFOLIO),
      ]),
    ).toThrow();
    expect(() =>
      assertProviderServiceEligible(item, 3, [
        document(ProviderDocumentType.PORTFOLIO),
        document(ProviderDocumentType.PORTFOLIO),
      ]),
    ).not.toThrow();
  });
});

describe('Provider review permissions and snapshot', () => {
  it.each([InternalRole.SERVICE_REVIEWER, InternalRole.SUPPORT])(
    'does not give KYC access to %s',
    (role) => {
      expect(canReviewProviderKyc([role])).toBe(false);
      expect(() =>
        assertProviderSectionReviewAllowed(
          [role],
          ProviderApplicationSection.IDENTITY,
        ),
      ).toThrow(ForbiddenException);
    },
  );
  it.each([
    InternalRole.ADMIN,
    InternalRole.KYC_REVIEWER,
    InternalRole.MODERATOR,
  ])('allows identity review by %s', (role) => {
    expect(canReviewProviderKyc([role])).toBe(true);
    expect(() =>
      assertProviderSectionReviewAllowed(
        [role],
        ProviderApplicationSection.IDENTITY,
      ),
    ).not.toThrow();
  });
  it('lets service reviewers review expertise but not terms', () => {
    expect(() =>
      assertProviderSectionReviewAllowed(
        [InternalRole.SERVICE_REVIEWER],
        ProviderApplicationSection.EXPERTISE,
      ),
    ).not.toThrow();
    expect(() =>
      assertProviderSectionReviewAllowed(
        [InternalRole.SERVICE_REVIEWER],
        ProviderApplicationSection.TERMS,
      ),
    ).toThrow();
  });
  it('removes sensitive fields recursively from revision snapshots', () => {
    expect(
      buildProviderSnapshot({
        nationalIdEncrypted: 'secret',
        nationalIdHash: 'secret',
        documents: [
          { fileUrl: 'private', publicId: 'secret', type: 'PORTRAIT' },
        ],
        terms: { ipAddress: 'private', userAgent: 'private' },
        createdAt: new Date('2026-09-28'),
      }),
    ).toEqual({
      documents: [{ type: 'PORTRAIT' }],
      terms: {},
      createdAt: '2026-09-28T00:00:00.000Z',
    });
  });
});
