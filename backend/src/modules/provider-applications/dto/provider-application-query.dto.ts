import { ProviderApplicationStatus, ProviderType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProviderApplicationQueryDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @IsEnum(ProviderApplicationStatus)
  @IsOptional()
  status?: ProviderApplicationStatus;

  @IsEnum(ProviderType)
  @IsOptional()
  providerType?: ProviderType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;
}
