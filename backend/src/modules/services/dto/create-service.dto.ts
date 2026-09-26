import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsIcon } from '../../../common/validation/icon.validator';
import {
  normalizeServiceCode,
  normalizeServiceSlug,
  trimString,
} from './service-transformers';

const MAX_PRICE_AMOUNT = 2_000_000_000;

export class CreateServiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId: string;

  @ApiProperty({ example: 'MEN_HAIRCUT' })
  @Transform(normalizeServiceCode)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/)
  code: string;

  @ApiProperty({ example: 'Cắt tóc nam' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'cat-toc-nam' })
  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  slug: string;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ example: 'content_cut' })
  @Transform(trimString)
  @IsIcon()
  @IsOptional()
  @MaxLength(2048)
  iconUrl?: string | null;

  @ApiProperty({ example: 50000, description: 'Giá sàn, đơn vị VND' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_AMOUNT)
  minPriceAmount: number;

  @ApiProperty({ example: 300000, description: 'Giá trần, đơn vị VND' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_AMOUNT)
  maxPriceAmount: number;

  @ApiPropertyOptional({ example: 45 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  defaultDurationMinutes?: number | null;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
