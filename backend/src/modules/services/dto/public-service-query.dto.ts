import { ServiceTargetAudience } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { normalizeServiceSlug } from './service-transformers';

export class PublicServiceQueryDto {
  @ApiPropertyOptional({ example: 'toc', minLength: 2, maxLength: 120 })
  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: ServiceTargetAudience })
  @IsEnum(ServiceTargetAudience)
  @IsOptional()
  targetAudience?: ServiceTargetAudience;

  @ApiPropertyOptional({ example: 'cat toc', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: 300000,
    minimum: 1,
    maximum: 2_000_000_000,
    description: 'Chỉ lấy dịch vụ có giá sàn không vượt quá số tiền này.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  @IsOptional()
  maxPriceAmount?: number;
}
