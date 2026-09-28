import { BadRequestException } from '@nestjs/common';
import { Prisma, ProviderDocumentType, ProviderType } from '@prisma/client';
import { CURRENT_PROVIDER_TERMS_VERSION } from '../constants/provider-terms.constants';
import { assertProviderAdult } from './provider-birth-date.policy';
import { assertProviderServiceEligible } from './provider-service-eligibility.policy';

export type SubmittableApplication = Prisma.ProviderApplicationGetPayload<{
  include: {
    documents: true;
    services: { include: { service: { include: { category: true } } } };
    termsAcceptances: true;
    checks: true;
  };
}>;

export function assertProviderSubmissionComplete(
  application: SubmittableApplication,
): void {
  const missing: string[] = [];
  if (!application.email) missing.push('email liên hệ');
  else if (!application.emailVerifiedAt) missing.push('xác minh email liên hệ');
  const isIndividual = application.providerType === ProviderType.INDIVIDUAL;
  if (isIndividual) {
    if (!application.legalFullName) missing.push('họ tên pháp lý');
    if (!application.birthDate) missing.push('ngày sinh');
    else assertProviderAdult(application.birthDate);
    if (!application.nationalIdEncrypted) missing.push('số CCCD được bảo vệ');
    if (application.experienceYears === null)
      missing.push('số năm kinh nghiệm');
  } else {
    if (!application.organizationName) missing.push('tên tổ chức');
    if (!application.businessRegistrationNumber)
      missing.push('số đăng ký kinh doanh');
    if (!application.registeredAddress) missing.push('địa chỉ đăng ký');
    if (!application.representativeName) missing.push('người đại diện');
  }
  const requiredDocuments = isIndividual
    ? [
        ProviderDocumentType.PORTRAIT,
        ProviderDocumentType.ID_CARD_FRONT,
        ProviderDocumentType.ID_CARD_BACK,
        ProviderDocumentType.IDENTITY_SELFIE,
      ]
    : [ProviderDocumentType.PORTRAIT, ProviderDocumentType.BUSINESS_LICENSE];
  for (const type of requiredDocuments) {
    if (
      !application.documents.some(
        (doc) =>
          doc.type === type &&
          doc.status !== 'REJECTED' &&
          doc.deliveryType === 'authenticated' &&
          doc.fileFormat,
      )
    ) {
      missing.push(`tài liệu được bảo vệ ${type}`);
    }
  }
  if (!application.services.length) missing.push('ít nhất một dịch vụ');
  if (
    !application.termsAcceptances.some(
      (item) => item.termsVersion === CURRENT_PROVIDER_TERMS_VERSION,
    )
  )
    missing.push('điều khoản hiện hành');
  if (missing.length)
    throw new BadRequestException(`Hồ sơ chưa đầy đủ: ${missing.join(', ')}.`);
  for (const item of application.services)
    assertProviderServiceEligible(
      item,
      application.experienceYears,
      application.documents,
    );
}
