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
  normalizeSlug as normalizeCategorySlug,
  trimString,
} from '../../../common/validation/string-transformers';

export class UpdateCategoryDto {
  @Transform(trimString)
  @IsString({ message: 'Tên danh mục phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên danh mục không được để trống.' })
  @IsOptional()
  @MinLength(2, { message: 'Tên danh mục phải có ít nhất 2 ký tự.' })
  @MaxLength(100, { message: 'Tên danh mục không được vượt quá 100 ký tự.' })
  name?: string;

  @Transform(normalizeCategorySlug)
  @IsString({ message: 'Đường dẫn (slug) phải là chuỗi ký tự.' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Đường dẫn (slug) phải ở dạng chữ thường phân tách bằng dấu gạch ngang.',
  })
  @MinLength(2, { message: 'Đường dẫn (slug) phải có ít nhất 2 ký tự.' })
  @MaxLength(120, {
    message: 'Đường dẫn (slug) không được vượt quá 120 ký tự.',
  })
  slug?: string;

  @Transform(trimString)
  @IsString({ message: 'Mô tả danh mục phải là chuỗi ký tự.' })
  @IsOptional()
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự.' })
  description?: string | null;

  @Transform(trimString)
  @IsIcon({ message: 'Icon phải là mã Material Symbol hoặc URL HTTPS hợp lệ.' })
  @IsOptional()
  @MaxLength(2048, {
    message: 'Đường dẫn icon không được vượt quá 2048 ký tự.',
  })
  iconUrl?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'Thứ tự hiển thị phải là số nguyên.' })
  @Min(0, { message: 'Thứ tự hiển thị không được âm.' })
  @IsOptional()
  sortOrder?: number;
}
