import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RematchCandidatesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  radiusKm?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class RetryOrderDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  memberId?: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  providerServiceId: string;

  @ApiProperty({ description: 'Báo giá mới từ POST /api/orders/quote.' })
  @IsString()
  @MinLength(100)
  @MaxLength(2000)
  quoteToken: string;

  @ApiPropertyOptional({ example: 'LAMBE30' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z0-9_-]{4,32}$/)
  voucherCode?: string;
}
