import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletTopUpStatus, WalletTransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateMomoTopUpDto {
  @ApiProperty({ example: 100000, minimum: 1000, maximum: 50000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(50_000_000)
  amount: number;
}

export class WalletTransactionQueryDto {
  @ApiPropertyOptional({ enum: WalletTransactionType })
  @IsEnum(WalletTransactionType)
  @IsOptional()
  type?: WalletTransactionType;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class WalletTopUpQueryDto {
  @ApiPropertyOptional({ enum: WalletTopUpStatus })
  @IsEnum(WalletTopUpStatus)
  @IsOptional()
  status?: WalletTopUpStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class WalletTopUpParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}
