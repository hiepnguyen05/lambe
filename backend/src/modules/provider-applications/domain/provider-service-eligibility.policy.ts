import { BadRequestException } from '@nestjs/common';
import {
  ProviderDocumentType,
  ReviewStatus,
  ServiceCategoryStatus,
  ServiceStatus,
} from '@prisma/client';

interface ServiceRequirement {
  status: ServiceStatus;
  category: { status: ServiceCategoryStatus };
  minPriceAmount: number;
  maxPriceAmount: number;
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
}

interface EvidenceDocument {
  applicationServiceId: string | null;
  type: ProviderDocumentType;
  status: ReviewStatus;
  deliveryType: string;
  fileFormat: string | null;
}

export function assertProviderServiceEligible(
  item: {
    id: string;
    proposedPriceAmount: number;
    service: ServiceRequirement;
  },
  experienceYears: number | null,
  documents: EvidenceDocument[],
  requireVerified = false,
): void {
  const service = item.service;
  if (
    service.status !== ServiceStatus.ACTIVE ||
    service.category.status !== ServiceCategoryStatus.ACTIVE
  ) {
    throw new BadRequestException('Dịch vụ hoặc danh mục không còn hoạt động.');
  }
  if (
    item.proposedPriceAmount < service.minPriceAmount ||
    item.proposedPriceAmount > service.maxPriceAmount
  ) {
    throw new BadRequestException(
      'Giá đăng ký không còn nằm trong giá sàn/trần của dịch vụ.',
    );
  }
  if ((experienceYears ?? 0) < service.minExperienceYears) {
    throw new BadRequestException(
      'Kinh nghiệm chưa đáp ứng yêu cầu của dịch vụ.',
    );
  }
  const evidence = documents.filter(
    (doc) =>
      doc.applicationServiceId === item.id &&
      doc.deliveryType === 'authenticated' &&
      doc.fileFormat &&
      (requireVerified
        ? doc.status === ReviewStatus.VERIFIED
        : doc.status !== ReviewStatus.REJECTED),
  );
  if (
    service.requiresCertificate &&
    !evidence.some(
      (doc) => doc.type === ProviderDocumentType.PROFESSIONAL_CERTIFICATE,
    )
  ) {
    throw new BadRequestException(
      'Dịch vụ yêu cầu chứng chỉ nghề liên kết hợp lệ.',
    );
  }
  if (
    evidence.filter((doc) => doc.type === ProviderDocumentType.PORTFOLIO)
      .length < service.minPortfolioImages
  ) {
    throw new BadRequestException(
      'Chưa đủ ảnh portfolio liên kết cho dịch vụ.',
    );
  }
}
