import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherDiscountType, VoucherStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVoucherDto {
  @ApiProperty({ example: 'LAMBE30' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9_-]{4,32}$/)
  code: string;

  @ApiProperty({ enum: VoucherDiscountType })
  @IsEnum(VoucherDiscountType)
  discountType: VoucherDiscountType;

  @ApiProperty({ example: 30000 })
  @IsInt()
  @Min(1)
  value: number;

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  usageLimit: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Chỉ admin có thể giới hạn theo thợ.',
  })
  @IsOptional()
  @IsUUID('4')
  providerId?: string;
}

export class VoucherListQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã voucher.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  search?: string;

  @ApiPropertyOptional({ enum: VoucherStatus })
  @IsOptional()
  @IsEnum(VoucherStatus)
  status?: VoucherStatus;

  @ApiPropertyOptional({
    description: 'Chỉ lấy voucher có hiệu lực tại thời điểm này.',
  })
  @IsOptional()
  @IsDateString()
  activeAt?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class EligibleVouchersQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Dịch vụ cụ thể của thợ đã chọn.',
  })
  @IsUUID('4')
  providerServiceId: string;
}
