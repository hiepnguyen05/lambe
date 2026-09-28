import { ServiceTargetAudience } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeServiceSlug } from './service-transformers';

export class PublicServiceQueryDto {
  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  categorySlug?: string;

  @IsEnum(ServiceTargetAudience)
  @IsOptional()
  targetAudience?: ServiceTargetAudience;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  @IsOptional()
  maxPriceAmount?: number;
}
