import { ForbiddenException } from '@nestjs/common';
import { InternalRole, ProviderApplicationSection } from '@prisma/client';

export const PROVIDER_APPLICATION_REVIEWER_ROLES = [
  InternalRole.ADMIN,
  InternalRole.MODERATOR,
  InternalRole.KYC_REVIEWER,
] as const;

export function canReviewProviderKyc(roles: InternalRole[]): boolean {
  return PROVIDER_APPLICATION_REVIEWER_ROLES.some((role) =>
    roles.includes(role),
  );
}

export function assertProviderSectionReviewAllowed(
  roles: InternalRole[],
  section: ProviderApplicationSection,
): void {
  if (canReviewProviderKyc(roles)) return;
  const isServiceReviewer = roles.includes(InternalRole.SERVICE_REVIEWER);
  if (
    isServiceReviewer &&
    (section === ProviderApplicationSection.SERVICES ||
      section === ProviderApplicationSection.EXPERTISE)
  )
    return;
  throw new ForbiddenException('Bạn không có quyền xét duyệt hạng mục này.');
}
