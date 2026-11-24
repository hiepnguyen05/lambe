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
import { IsIcon } from '../../../common/validation/icon.validator';
import {
  normalizeCode as normalizeCategoryCode,
  normalizeSlug as normalizeCategorySlug,
  trimString,
} from '../../../common/validation/string-transformers';

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
  @IsString({ message: 'Tên danh mục phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên danh mục không được để trống.' })
  @MinLength(2, { message: 'Tên danh mục phải có ít nhất 2 ký tự.' })
  @MaxLength(100, { message: 'Tên danh mục không được vượt quá 100 ký tự.' })
  name: string;

  @ApiProperty({
    example: 'dich-vu-toc',
    description: 'Slug danh mục phục vụ URL',
  })
  @Transform(normalizeCategorySlug)
  @IsString({ message: 'Slug phải là chuỗi ký tự.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug phải ở dạng chữ thường phân tách bằng dấu gạch ngang.',
  })
  @MinLength(2, { message: 'Slug phải có ít nhất 2 ký tự.' })
  @MaxLength(120, { message: 'Slug không được vượt quá 120 ký tự.' })
  slug: string;

  @ApiPropertyOptional({
    example: 'Chăm sóc và cắt tạo kiểu tóc chuyên nghiệp',
  })
  @Transform(trimString)
  @IsString({ message: 'Mô tả danh mục phải là chuỗi ký tự.' })
  @IsOptional()
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự.' })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'content_cut',
    description: 'Tên Material Symbol hoặc URL Cloudinary ảnh icon',
  })
  @Transform(trimString)
  @IsIcon({ message: 'Icon phải là mã Material Symbol hoặc URL HTTPS hợp lệ.' })
  @IsOptional()
  @MaxLength(2048, {
    message: 'Đường dẫn icon không được vượt quá 2048 ký tự.',
  })
  iconUrl?: string | null;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên.' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm.' })
  @IsOptional()
  sortOrder?: number;
}
