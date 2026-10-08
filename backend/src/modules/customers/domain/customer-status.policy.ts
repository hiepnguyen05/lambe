import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InternalRole, UserStatus } from '@prisma/client';

export function assertCustomerStatusChangeAllowed(
  currentStatus: UserStatus,
  nextStatus: UserStatus,
  actorRoles: InternalRole[],
): void {
  if (currentStatus === nextStatus) {
    throw new BadRequestException(
      'Tài khoản khách hàng đã ở trạng thái được yêu cầu.',
    );
  }

  if (actorRoles.includes(InternalRole.ADMIN)) return;

  const supportTransition =
    actorRoles.includes(InternalRole.SUPPORT) &&
    ((currentStatus === UserStatus.ACTIVE &&
      nextStatus === UserStatus.BLOCKED) ||
      (currentStatus === UserStatus.BLOCKED &&
        nextStatus === UserStatus.ACTIVE));

  if (!supportTransition) {
    throw new ForbiddenException(
      'Bộ phận hỗ trợ chỉ được khóa hoặc mở khóa tài khoản khách hàng.',
    );
  }
}
