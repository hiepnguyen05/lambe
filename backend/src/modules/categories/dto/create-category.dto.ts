import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import {
  normalizeCategoryCode,
  normalizeCategorySlug,
  trimString,
} from './category-transformers';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'HAIR',
    description: 'Mã danh mục dịch vụ (chỉ chữ hoa, số và dấu _)',
  })
  @Transform(normalizeCategoryCode)
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message:
      'Mã danh mục phải bắt đầu bằng chữ cái, dài 2-50 ký tự và chỉ chứa chữ hoa, số hoặc dấu gạch dưới.',
  })
  code: string;

  @ApiProperty({ example: 'Dịch vụ Tóc', description: 'Tên hiển thị danh mục' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'dich-vu-toc',
    description: 'Slug danh mục phục vụ URL',
  })
  @Transform(normalizeCategorySlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug phải ở dạng chữ thường phân tách bằng dấu gạch ngang.',
  })
  @MinLength(2)
  @MaxLength(120)
  slug: string;

  @ApiPropertyOptional({
    example: 'Chăm sóc và cắt tạo kiểu tóc chuyên nghiệp',
  })
  @Transform(trimString)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    example: 'content_cut',
    description: 'Tên Material Symbol hoặc URL Cloudinary ảnh icon',
  })
  @Transform(trimString)
  @IsCategoryIcon()
  @IsOptional()
  @MaxLength(2048)
  iconUrl?: string | null;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
