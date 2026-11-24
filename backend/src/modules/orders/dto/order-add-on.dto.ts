import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class OrderAddOnParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class OrderAddOnDecisionParamDto extends OrderAddOnParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  addOnId: string;
}

export class CreateOrderAddOnDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  providerServiceId: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DecideOrderAddOnDto {
  @ApiProperty({ description: 'Khách chấp nhận hoặc từ chối giá phát sinh.' })
  @IsBoolean()
  approve: boolean;
}
