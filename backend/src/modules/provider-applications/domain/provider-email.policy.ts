import { ConflictException } from '@nestjs/common';
import { ProviderApplicationStatus } from '@prisma/client';

export function assertProviderEmailVerifiable(
  status: ProviderApplicationStatus,
): void {
  // Existing pending applications may verify their unchanged contact email after upgrade.
  if (
    status !== ProviderApplicationStatus.DRAFT &&
    status !== ProviderApplicationStatus.NEEDS_CHANGES &&
    status !== ProviderApplicationStatus.PENDING_REVIEW
  ) {
    throw new ConflictException(
      'Không thể xác minh email của hồ sơ đã kết thúc.',
    );
  }
}
