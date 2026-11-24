import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderSafetyReason } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RaiseOrderSafetyDto {
  @ApiPropertyOptional({
    enum: OrderSafetyReason,
    default: OrderSafetyReason.THREAT,
  })
  @IsEnum(OrderSafetyReason)
  @IsOptional()
  reason?: OrderSafetyReason;

  @ApiPropertyOptional({ description: 'Có thể bổ sung sau khi đã an toàn.' })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  detail?: string;
}

export class CloseOrderSafetyDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  resolutionNote: string;
}

export class OrderSafetyParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class OrderSafetyEvidenceParamDto extends OrderSafetyParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  evidenceId: string;
}
