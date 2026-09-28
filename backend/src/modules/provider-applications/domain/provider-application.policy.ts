import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ProviderApplicationStatus,
  ProviderApplicationSection,
  ReviewStatus,
  type ProviderDocumentType,
} from '@prisma/client';

export const REQUIRED_REVIEW_SECTIONS = [
  'IDENTITY',
  'PORTRAIT',
  'EXPERTISE',
  'SERVICES',
  'TERMS',
] as const;

export const SINGLETON_DOCUMENT_TYPES: readonly ProviderDocumentType[] = [
  'PORTRAIT',
  'ID_CARD_FRONT',
  'ID_CARD_BACK',
  'IDENTITY_SELFIE',
  'BUSINESS_LICENSE',
];

export function assertApplicationEditable(
  status: ProviderApplicationStatus,
): void {
  if (
    status !== ProviderApplicationStatus.DRAFT &&
    status !== ProviderApplicationStatus.NEEDS_CHANGES
  ) {
    throw new ConflictException(
      'Hồ sơ không thể chỉnh sửa ở trạng thái hiện tại.',
    );
  }
}

export function assertApplicationOwnedBy(
  ownerUserId: string,
  currentUserId: string,
): void {
  if (ownerUserId !== currentUserId) {
    throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ này.');
  }
}

export function assertReviewNote(status: ReviewStatus, note?: string | null) {
  if (status !== ReviewStatus.VERIFIED && !note?.trim()) {
    throw new BadRequestException(
      'Phải ghi nhận xét khi yêu cầu bổ sung hoặc từ chối hạng mục.',
    );
  }
}

export function assertProviderSectionsEditable(
  application: {
    status: ProviderApplicationStatus;
    checks: { section: ProviderApplicationSection; status: ReviewStatus }[];
  },
  sections: ProviderApplicationSection[],
  itemNeedsChanges = false,
): void {
  if (
    application.status !== ProviderApplicationStatus.NEEDS_CHANGES ||
    itemNeedsChanges
  )
    return;
  const locked = sections.find(
    (section) =>
      !application.checks.some(
        (check) =>
          check.section === section &&
          (check.status === ReviewStatus.NEEDS_CHANGES ||
            check.status === ReviewStatus.PENDING),
      ),
  );
  if (locked)
    throw new ConflictException(
      `Hạng mục ${locked} đã bị khóa vì không được yêu cầu bổ sung.`,
    );
}
