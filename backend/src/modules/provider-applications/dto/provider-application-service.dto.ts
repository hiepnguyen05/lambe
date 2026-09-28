import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimOptionalString } from './provider-transformers';

const MAX_PRICE_AMOUNT = 2_000_000_000;

export class AddProviderApplicationServiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  serviceId: string;

  @ApiProperty({ example: 150000, description: 'Giá đề xuất bằng VND' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_AMOUNT)
  proposedPriceAmount: number;

  @ApiPropertyOptional({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  durationMinutes?: number | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;
}

export class UpdateProviderApplicationServiceDto extends PartialType(
  AddProviderApplicationServiceDto,
  { skipNullProperties: false },
) {}
