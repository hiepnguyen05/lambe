import { BadRequestException } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';

const allowedStatusTransitions: Record<
  ServiceStatus,
  readonly ServiceStatus[]
> = {
  INACTIVE: [ServiceStatus.ACTIVE, ServiceStatus.ARCHIVED],
  ACTIVE: [ServiceStatus.INACTIVE, ServiceStatus.ARCHIVED],
  ARCHIVED: [ServiceStatus.INACTIVE],
};

export function assertServiceStatusTransition(
  current: ServiceStatus,
  next: ServiceStatus,
): void {
  if (current === next) {
    throw new BadRequestException(`Dịch vụ đã ở trạng thái ${next}.`);
  }

  if (!allowedStatusTransitions[current].includes(next)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái từ ${current} sang ${next}.`,
    );
  }
}

export function assertValidPriceRange(min: number, max: number): void {
  if (min > max) {
    throw new BadRequestException('Giá sàn không được lớn hơn giá trần.');
  }
}
