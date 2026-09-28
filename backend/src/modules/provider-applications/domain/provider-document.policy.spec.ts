import {
  ProviderDocumentType,
  ProviderApplicationStatus,
} from '@prisma/client';
import { assertProviderDocumentQuota } from './provider-document.policy';
import { assertProviderEmailVerifiable } from './provider-email.policy';

describe('Provider document quotas', () => {
  it.each([
    [ProviderDocumentType.PORTFOLIO, 40],
    [ProviderDocumentType.PROFESSIONAL_CERTIFICATE, 15],
    [ProviderDocumentType.OTHER, 5],
  ] as const)('limits %s to %i documents', (type, limit) => {
    const documents = Array.from({ length: limit }, () => ({ type }));
    expect(() => assertProviderDocumentQuota(documents, type, false)).toThrow();
    expect(() =>
      assertProviderDocumentQuota(documents, type, true),
    ).not.toThrow();
  });
  it('enforces the total limit even for a type below its individual quota', () => {
    const documents = Array.from({ length: 60 }, () => ({
      type: ProviderDocumentType.PORTFOLIO,
    }));
    expect(() =>
      assertProviderDocumentQuota(documents, ProviderDocumentType.OTHER, false),
    ).toThrow();
  });
});

describe('Email verification status policy', () => {
  it('allows legacy pending applications to verify their unchanged email', () => {
    expect(() =>
      assertProviderEmailVerifiable(ProviderApplicationStatus.PENDING_REVIEW),
    ).not.toThrow();
  });
  it.each([
    ProviderApplicationStatus.APPROVED,
    ProviderApplicationStatus.REJECTED,
    ProviderApplicationStatus.WITHDRAWN,
  ])('does not reopen a finished %s application', (status) => {
    expect(() => assertProviderEmailVerifiable(status)).toThrow();
  });
});
