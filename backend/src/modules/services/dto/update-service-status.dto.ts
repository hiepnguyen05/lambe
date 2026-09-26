import { ServiceStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateServiceStatusDto {
  @IsEnum(ServiceStatus)
  status: ServiceStatus;
}
