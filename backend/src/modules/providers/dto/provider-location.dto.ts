import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

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
