import { BadRequestException } from '@nestjs/common';
import { ProviderDocumentType } from '@prisma/client';
import { assertProviderAdult } from '../../../common/validation/provider-birth-date.policy';
import { MEMBER_TERMS_VERSION } from './member-verification.constants';

interface VerificationInput {
  legalFullName: string | null;
  birthDate: Date | null;
  gender: string | null;
  nationalIdEncrypted: string | null;
  experienceYears: number | null;
  termsVersion: string | null;
  termsAcceptedAt: Date | null;
  requestedProviderServiceIds: string[];
  documents: {
    type: ProviderDocumentType;
    providerServiceId: string | null;
    deliveryType: string;
    fileFormat: string;
    status: string;
    expiresAt: Date | null;
  }[];
}

export const MEMBER_IDENTITY_DOCUMENTS: ProviderDocumentType[] = [
  'PORTRAIT',
  'ID_CARD_FRONT',
  'ID_CARD_BACK',
  'IDENTITY_SELFIE',
];

export interface MemberOfferingRequirement {
  id: string;
  status: string;
  service: {
    status: string;
    category: { status: string };
    requiresCertificate: boolean;
    minExperienceYears: number;
    minPortfolioImages: number;
  };
}

export function assertMemberVerificationComplete(
  profile: VerificationInput,
  offerings: MemberOfferingRequirement[],
  verified: boolean,
  validUntil = new Date(),
) {
  if (
    !profile.legalFullName ||
    !profile.birthDate ||
    !profile.gender ||
    !profile.nationalIdEncrypted ||
    profile.experienceYears === null ||
    profile.termsVersion !== MEMBER_TERMS_VERSION ||
    !profile.termsAcceptedAt
  ) {
    throw new BadRequestException(
      'Hồ sơ thiếu thông tin cá nhân hoặc chấp thuận điều khoản hiện hành.',
    );
  }
  assertProviderAdult(profile.birthDate);
  if (
    profile.documents.some((d) =>
      ['REJECTED', 'NEEDS_CHANGES'].includes(d.status),
    )
  )
    throw new BadRequestException(
      'Cần thay hoặc bỏ các tài liệu bị từ chối/yêu cầu bổ sung trước khi gửi.',
    );
  const documents = profile.documents.filter(
    (d) =>
      d.deliveryType === 'authenticated' &&
      ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(d.fileFormat) &&
      (verified
        ? d.status === 'VERIFIED'
        : !['REJECTED', 'NEEDS_CHANGES'].includes(d.status)) &&
      (!d.expiresAt || d.expiresAt > validUntil),
  );
  for (const type of MEMBER_IDENTITY_DOCUMENTS) {
    if (!documents.some((d) => d.type === type))
      throw new BadRequestException(`Thiếu tài liệu hợp lệ ${type}.`);
  }
  if (
    !profile.requestedProviderServiceIds.length ||
    offerings.length !== profile.requestedProviderServiceIds.length
  )
    throw new BadRequestException(
      'Dịch vụ đề nghị xác minh không còn thuộc tổ chức.',
    );
  for (const offering of offerings) {
    if (
      offering.status !== 'ACTIVE' ||
      offering.service.status !== 'ACTIVE' ||
      offering.service.category.status !== 'ACTIVE'
    )
      throw new BadRequestException(
        'Dịch vụ hoặc danh mục không còn hoạt động.',
      );
    if ((profile.experienceYears ?? 0) < offering.service.minExperienceYears)
      throw new BadRequestException(
        'Kinh nghiệm chưa đáp ứng yêu cầu dịch vụ.',
      );
    const evidence = documents.filter(
      (d) => d.providerServiceId === offering.id,
    );
    if (
      offering.service.requiresCertificate &&
      !evidence.some((d) => d.type === 'PROFESSIONAL_CERTIFICATE')
    )
      throw new BadRequestException(
        'Dịch vụ yêu cầu chứng chỉ nghề đã liên kết, còn hạn và hợp lệ.',
      );
    if (
      evidence.filter((d) => d.type === 'PORTFOLIO').length <
      offering.service.minPortfolioImages
    )
      throw new BadRequestException('Chưa đủ portfolio hợp lệ cho dịch vụ.');
  }
}
