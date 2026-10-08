import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderProfileStatus, ProviderType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminProviderQueryDto {
  @ApiPropertyOptional({
    description:
      'Tìm theo mã hồ sơ, tên hiển thị, tên tài khoản hoặc số điện thoại.',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  providerType?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderProfileStatus })
  @IsEnum(ProviderProfileStatus)
  @IsOptional()
  status?: ProviderProfileStatus;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;
}

export enum AdminProviderStatusAction {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateAdminProviderStatusDto {
  @ApiProperty({ enum: AdminProviderStatusAction })
  @IsEnum(AdminProviderStatusAction)
  status: AdminProviderStatusAction;

  @ApiProperty({
    example: 'Tạm dừng để xác minh phản ánh từ khách hàng.',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
