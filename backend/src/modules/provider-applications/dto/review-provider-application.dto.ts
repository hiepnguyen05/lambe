import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimOptionalString } from './provider-transformers';

export class ReviewItemDto {
  @ApiProperty({
    enum: [
      ReviewStatus.VERIFIED,
      ReviewStatus.NEEDS_CHANGES,
      ReviewStatus.REJECTED,
    ],
  })
  @IsIn([
    ReviewStatus.VERIFIED,
    ReviewStatus.NEEDS_CHANGES,
    ReviewStatus.REJECTED,
  ])
  status: ReviewStatus;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  reviewNote?: string | null;
}

export class ProviderApplicationDecisionDto {
  @ApiProperty({ example: 'Ảnh CCCD mặt trước bị mờ.' })
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}
