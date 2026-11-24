import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
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

export class BookingAvailabilityQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Bắt buộc khi chọn nhân viên tổ chức.',
  })
  @IsUUID('4')
  @IsOptional()
  memberId?: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  providerServiceId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  customerAddressId: string;

  @ApiProperty({
    example: '2026-10-13',
    description: 'Calendar date in Asia/Ho_Chi_Minh.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date: string;

  @ApiPropertyOptional({ default: 20, maximum: 48 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  @IsOptional()
  limit?: number;
}

export class CalendarRangeDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  from: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  to: string;
}

export class CreateTimeOffDto extends CalendarRangeDto {
  @ApiProperty({ example: 'Nghi ca chieu' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}
