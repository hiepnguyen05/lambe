import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCategoryIcon } from './category-icon.validator';
import { normalizeCategorySlug, trimString } from './category-transformers';

export class UpdateCategoryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @Transform(normalizeCategorySlug)
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug phải ở dạng chữ thường phân tách bằng dấu gạch ngang.',
  })
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @Transform(trimString)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @Transform(trimString)
  @IsCategoryIcon()
  @IsOptional()
  @MaxLength(2048)
  iconUrl?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
