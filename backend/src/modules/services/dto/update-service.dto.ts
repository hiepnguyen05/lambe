import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsIcon } from '../../../common/validation/icon.validator';
import { normalizeServiceSlug, trimString } from './service-transformers';

const MAX_PRICE_AMOUNT = 2_000_000_000;

export class UpdateServiceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  slug?: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @Transform(trimString)
  @IsIcon()
  @MaxLength(2048)
  @IsOptional()
  iconUrl?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_AMOUNT)
  @IsOptional()
  minPriceAmount?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_AMOUNT)
  @IsOptional()
  maxPriceAmount?: number;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  defaultDurationMinutes?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
