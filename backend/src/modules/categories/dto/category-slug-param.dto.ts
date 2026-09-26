import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeCategorySlug } from './category-transformers';

export class CategorySlugParamDto {
  @ApiProperty({ example: 'toc' })
  @Transform(normalizeCategorySlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug phải ở dạng chữ thường phân tách bằng dấu gạch ngang.',
  })
  @MinLength(2)
  @MaxLength(120)
  slug: string;
}
