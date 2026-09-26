import { ServiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ServiceQueryDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
