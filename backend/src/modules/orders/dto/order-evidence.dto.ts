import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderEvidenceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class OrderEvidenceParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ enum: OrderEvidenceType })
  @IsEnum(OrderEvidenceType)
  type: OrderEvidenceType;
}

export class OrderEvidenceLocationDto {
  @ApiPropertyOptional({
    description: 'Vị trí thiết bị báo cáo, chưa được xác minh độc lập.',
  })
  @Type(() => Number)
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsLongitude()
  @IsOptional()
  longitude?: number;
}

export class OrderEvidenceIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  evidenceId: string;
}
