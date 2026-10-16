import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BookingType } from '@prisma/client';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsEnum,
  IsDateString,
  ValidateIf,
  Matches,
} from 'class-validator';

export class ProviderSearchDto {
  @ApiPropertyOptional({ enum: BookingType, default: BookingType.ASAP })
  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Required with SCHEDULED. Include timezone.',
  })
  @ValidateIf(
    (dto: ProviderSearchDto) =>
      dto.bookingType === BookingType.SCHEDULED ||
      dto.scheduledAt !== undefined,
  )
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledAt?: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  serviceId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Địa chỉ đã lưu của khách. Ưu tiên hơn latitude/longitude.',
  })
  @IsUUID('4')
  @IsOptional()
  customerAddressId?: string;

  @ApiPropertyOptional({ example: 10.7731 })
  @Type(() => Number)
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.703 })
  @Type(() => Number)
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  radiusKm?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class PublicProviderParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}
