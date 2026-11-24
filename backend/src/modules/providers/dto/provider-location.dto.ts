import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class ProviderLocationDto {
  @ApiProperty({ example: 21.0368 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 105.7827 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}

export class ProviderRealtimeLocationDto extends ProviderLocationDto {
  @ApiProperty({
    example: 12.4,
    minimum: 0,
    maximum: 100,
    description: 'Độ chính xác GPS do thiết bị báo, tính bằng mét.',
  })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  accuracyMeters: number;

  @ApiProperty({
    example: '2026-11-05T05:30:00.000Z',
    format: 'date-time',
    description: 'Thời điểm thiết bị ghi nhận vị trí, có kèm múi giờ.',
  })
  @IsDateString({ strict: true })
  capturedAt: string;

  @ApiProperty({
    example: 1793856600000,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    description:
      'Số thứ tự tăng dần của mẫu GPS trong thiết bị; Lambe dùng epoch milliseconds.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  sequence: number;
}
