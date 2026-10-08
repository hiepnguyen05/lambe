import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CreateServiceDto } from '../../services/dto/create-service.dto';
import { trimOptionalString } from './provider-transformers';

export class CreateProviderServiceSuggestionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId: string;

  @ApiProperty({ example: 'Tạo kiểu tóc đi tiệc' })
  @Transform(trimOptionalString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null;

  @ApiProperty({ example: 180000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  proposedPriceAmount: number;

  @ApiPropertyOptional({ example: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(720)
  @IsOptional()
  durationMinutes?: number | null;
}

export class UpdateProviderServiceSuggestionDto extends PartialType(
  CreateProviderServiceSuggestionDto,
  { skipNullProperties: false },
) {}

export class ApproveProviderServiceSuggestionDto extends CreateServiceDto {}

export class RejectProviderServiceSuggestionDto {
  @ApiProperty({ example: 'Dịch vụ đã có trong danh mục.' })
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}
