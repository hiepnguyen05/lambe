import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerOnboardingStatus,
  Gender,
  ProviderProfileStatus,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CustomerQueryDto {
  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Tìm theo mã khách hàng, họ tên hoặc số điện thoại.',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ enum: CustomerOnboardingStatus })
  @IsEnum(CustomerOnboardingStatus)
  @IsOptional()
  onboardingStatus?: CustomerOnboardingStatus;

  @ApiPropertyOptional({ enum: ProviderProfileStatus })
  @IsEnum(ProviderProfileStatus)
  @IsOptional()
  providerStatus?: ProviderProfileStatus;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Thời điểm đăng ký sớm nhất, theo ISO 8601.',
  })
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description: 'Thời điểm đăng ký muộn nhất, theo ISO 8601.',
  })
  @IsDateString()
  @IsOptional()
  createdTo?: string;

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

export class CustomerActivityQueryDto {
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

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.BLOCKED })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiProperty({
    example: 'Tạm khóa để xác minh phản ánh từ khách hàng.',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
