import { ServiceCategoryStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCategoryStatusDto {
  @IsEnum(ServiceCategoryStatus)
  status: ServiceCategoryStatus;
}
