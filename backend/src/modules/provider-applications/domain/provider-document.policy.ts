import { BadRequestException } from '@nestjs/common';
import {
  ProviderApplicationSection,
  ProviderDocumentType,
} from '@prisma/client';

export const PROVIDER_DOCUMENT_LIMITS = {
  total: 60,
  portfolio: 40,
  certificates: 15,
  other: 5,
} as const;

export function providerDocumentSection(
  type: ProviderDocumentType,
): ProviderApplicationSection {
  if (type === ProviderDocumentType.PORTRAIT)
    return ProviderApplicationSection.PORTRAIT;
  if (
    [
      ProviderDocumentType.ID_CARD_FRONT,
      ProviderDocumentType.ID_CARD_BACK,
      ProviderDocumentType.IDENTITY_SELFIE,
      ProviderDocumentType.BUSINESS_LICENSE,
    ].some((identityType) => identityType === type)
  )
    return ProviderApplicationSection.IDENTITY;
  return ProviderApplicationSection.EXPERTISE;
}

export function assertProviderDocumentQuota(
  documents: { type: ProviderDocumentType }[],
  type: ProviderDocumentType,
  replacing: boolean,
): void {
  if (replacing) return;
  const count = documents.filter((item) => item.type === type).length;
  const limit =
    type === ProviderDocumentType.PORTFOLIO
      ? PROVIDER_DOCUMENT_LIMITS.portfolio
      : type === ProviderDocumentType.PROFESSIONAL_CERTIFICATE
        ? PROVIDER_DOCUMENT_LIMITS.certificates
        : type === ProviderDocumentType.OTHER
          ? PROVIDER_DOCUMENT_LIMITS.other
          : PROVIDER_DOCUMENT_LIMITS.total;
  if (documents.length >= PROVIDER_DOCUMENT_LIMITS.total || count >= limit)
    throw new BadRequestException('Hồ sơ đã đạt giới hạn số lượng tài liệu.');
}
