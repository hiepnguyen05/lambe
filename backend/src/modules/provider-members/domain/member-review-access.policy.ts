import { ForbiddenException } from '@nestjs/common';
import { InternalRole } from '@prisma/client';

export const MEMBER_KYC_REVIEWER_ROLES = [
  InternalRole.ADMIN,
  InternalRole.MODERATOR,
  InternalRole.KYC_REVIEWER,
];
export function assertMemberKycReviewer(roles: InternalRole[]) {
  if (!MEMBER_KYC_REVIEWER_ROLES.some((role) => roles.includes(role)))
    throw new ForbiddenException(
      'Bạn không có quyền truy cập hoặc xét duyệt KYC thành viên.',
    );
}
