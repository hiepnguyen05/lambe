import { BadRequestException } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { REQUIRED_REVIEW_SECTIONS } from './provider-application.policy';
import {
  assertProviderSubmissionComplete,
  type SubmittableApplication,
} from './provider-submission.policy';
import { assertProviderServiceEligible } from './provider-service-eligibility.policy';

export function assertProviderApprovable(
  application: SubmittableApplication,
): void {
  if (
    !REQUIRED_REVIEW_SECTIONS.every((section) =>
      application.checks.some(
        (item) =>
          item.section === section && item.status === ReviewStatus.VERIFIED,
      ),
    )
  ) {
    throw new BadRequestException(
      'Tất cả hạng mục hồ sơ phải được xác minh trước khi duyệt.',
    );
  }
  if (
    [...application.documents, ...application.services].some(
      (item) =>
        item.status === ReviewStatus.PENDING ||
        item.status === ReviewStatus.NEEDS_CHANGES,
    )
  ) {
    throw new BadRequestException(
      'Vẫn còn tài liệu hoặc dịch vụ chưa được xử lý.',
    );
  }
  const services = application.services.filter(
    (item) => item.status === ReviewStatus.VERIFIED,
  );
  const documents = application.documents.filter(
    (item) => item.status === ReviewStatus.VERIFIED,
  );
  assertProviderSubmissionComplete({ ...application, services, documents });
  for (const item of services)
    assertProviderServiceEligible(
      item,
      application.experienceYears,
      documents,
      true,
    );
}
