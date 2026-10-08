import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CustomerAddressType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VIETNAMESE_PHONE_PATTERN } from '../../../common/constants/validation.constants';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateCustomerAddressDto {
  @ApiPropertyOptional({
    enum: CustomerAddressType,
    default: CustomerAddressType.HOME,
    example: CustomerAddressType.HOME,
  })
  @IsEnum(CustomerAddressType)
  @IsOptional()
  type?: CustomerAddressType;

  @ApiProperty({ example: 'Nhà' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: '12 Nguyễn Huệ, Quận 1, TP.HCM' })
  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine: string;

  @ApiPropertyOptional({ example: 'Thành phố Hồ Chí Minh' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  provinceName?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  districtName?: string;

  @ApiPropertyOptional({ example: 'Phường Bến Nghé' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  wardName?: string;

  @ApiPropertyOptional({ example: '12 Nguyễn Huệ' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  @IsOptional()
  streetLine?: string;

  @ApiProperty({ example: 10.7731 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 106.703 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Cho biết người dùng đã kiểm tra và xác nhận ghim vị trí trên bản đồ.',
  })
  @IsBoolean()
  @IsOptional()
  isMapConfirmed?: boolean;

  @ApiPropertyOptional({ example: 'Nguyễn Minh Anh' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @Transform(trimString)
  @Matches(VIETNAMESE_PHONE_PATTERN)
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Gọi trước khi đến' })
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto extends PartialType(
  CreateCustomerAddressDto,
) {}

export class CustomerAddressParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}
