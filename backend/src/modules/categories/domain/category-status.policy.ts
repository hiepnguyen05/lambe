import { BadRequestException } from '@nestjs/common';
import { ServiceCategoryStatus } from '@prisma/client';

const allowedStatusTransitions: Record<
  ServiceCategoryStatus,
  readonly ServiceCategoryStatus[]
> = {
  INACTIVE: [ServiceCategoryStatus.ACTIVE, ServiceCategoryStatus.ARCHIVED],
  ACTIVE: [ServiceCategoryStatus.INACTIVE, ServiceCategoryStatus.ARCHIVED],
  ARCHIVED: [ServiceCategoryStatus.INACTIVE],
};

export function assertCategoryStatusTransition(
  current: ServiceCategoryStatus,
  next: ServiceCategoryStatus,
): void {
  if (current === next) {
    throw new BadRequestException(`Danh mục đã ở trạng thái ${next}.`);
  }

  if (!allowedStatusTransitions[current].includes(next)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái từ ${current} sang ${next}.`,
    );
  }
}
