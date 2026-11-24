import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class OrderLocationDto {
  @ApiProperty({ example: 21.0285 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 105.8542 })
  @IsLongitude()
  longitude: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  @Max(100)
  accuracyMeters: number;

  @ApiProperty({ example: '2026-10-20T06:00:00.000Z' })
  @IsDateString()
  capturedAt: string;

  @ApiPropertyOptional({ example: 135 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  headingDegrees?: number;
}
