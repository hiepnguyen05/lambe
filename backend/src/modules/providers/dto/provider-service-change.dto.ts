import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProviderServiceChangeStatus,
  ProviderServiceChangeType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  trimOptionalString,
  trimString,
} from '../../../common/validation/string-transformers';
import { CreateServiceDto } from '../../services/dto/create-service.dto';

export class CreateProviderServiceChangeDto {
  @ApiProperty({ enum: ProviderServiceChangeType })
  @IsEnum(ProviderServiceChangeType)
  type: ProviderServiceChangeType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Dịch vụ hệ thống khi thêm mới.',
  })
  @IsUUID('4')
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Dịch vụ đối tác khi đề xuất chỉnh sửa.',
  })
  @IsUUID('4')
  @IsOptional()
  providerServiceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Danh mục cho dịch vụ chưa có trong hệ thống.',
  })
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Tạo kiểu tóc đi tiệc' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 150000, description: 'Giá đề xuất bằng VND.' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  proposedPriceAmount: number;

  @ApiPropertyOptional({ example: 60 })
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  proposedDurationMinutes?: number | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  proposedDescription?: string | null;
}

export class UpdateProviderServiceChangeDto {
  @ApiPropertyOptional({ example: 160000 })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  @ValidateIf((_, value: unknown) => value !== undefined)
  proposedPriceAmount?: number;

  @ApiPropertyOptional({ example: 75 })
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  proposedDurationMinutes?: number | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  proposedDescription?: string | null;

  @ApiPropertyOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @ValidateIf((_, value: unknown) => value !== undefined)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @ValidateIf((_, value: unknown) => value !== undefined)
  categoryId?: string;
}

export class ProviderServiceChangeQueryDto {
  @ApiPropertyOptional({ enum: ProviderServiceChangeStatus })
  @IsEnum(ProviderServiceChangeStatus)
  @IsOptional()
  status?: ProviderServiceChangeStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;
}

export class ProviderServiceChangeDecisionDto {
  @ApiProperty({ example: 'Ảnh chứng chỉ bị mờ, vui lòng tải lại.' })
  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}

export class ApproveProviderServiceChangeDto {
  @ApiPropertyOptional({
    description:
      'Thông tin dịch vụ chuẩn mới, chỉ dùng khi duyệt đề xuất chưa có.',
  })
  @ValidateNested()
  @Type(() => CreateServiceDto)
  @IsOptional()
  createService?: CreateServiceDto;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ghép đề xuất trùng vào dịch vụ hiện có.',
  })
  @IsUUID('4')
  @IsOptional()
  mapToServiceId?: string;
}
