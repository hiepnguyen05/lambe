import { ProviderApplicationStatus, ProviderType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProviderApplicationQueryDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ProviderApplicationStatus })
  @IsEnum(ProviderApplicationStatus)
  @IsOptional()
  status?: ProviderApplicationStatus;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsEnum(ProviderType)
  @IsOptional()
  providerType?: ProviderType;

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
