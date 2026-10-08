import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ProviderSearchDto {
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
