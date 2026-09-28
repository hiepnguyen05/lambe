import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerPricePreference,
  Gender,
  ServiceTargetAudience,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class OnboardingAddressDto {
  @ApiProperty({ example: 'Nhà' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: '12 Nguyễn Huệ, Quận 1, TP.HCM' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  addressLine: string;

  @ApiProperty({ example: 10.7731 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 106.703 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}

export class UpdateCustomerOnboardingDto {
  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender | null;

  @ApiPropertyOptional({
    enum: ServiceTargetAudience,
    default: ServiceTargetAudience.ALL,
  })
  @IsEnum(ServiceTargetAudience)
  @IsOptional()
  preferredAudience?: ServiceTargetAudience;

  @ApiPropertyOptional({
    enum: CustomerPricePreference,
    default: CustomerPricePreference.NO_PREFERENCE,
  })
  @IsEnum(CustomerPricePreference)
  @IsOptional()
  pricePreference?: CustomerPricePreference;

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  serviceIds?: string[];

  @ApiPropertyOptional({ type: OnboardingAddressDto })
  @ValidateNested()
  @Type(() => OnboardingAddressDto)
  @IsOptional()
  defaultAddress?: OnboardingAddressDto;
}
