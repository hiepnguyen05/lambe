import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

const stringValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export class MomoIpnDto {
  @Transform(stringValue)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  partnerCode: string;

  @Transform(stringValue)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  orderId: string;

  @Transform(stringValue)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  requestId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @Transform(stringValue)
  @IsString()
  @MaxLength(255)
  orderInfo: string;

  @Transform(stringValue)
  @IsString()
  @MaxLength(100)
  orderType: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  transId: number;

  @Type(() => Number)
  @IsInt()
  resultCode: number;

  @Transform(stringValue)
  @IsString()
  @MaxLength(500)
  message: string;

  @Transform(stringValue)
  @IsString()
  @MaxLength(100)
  payType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  responseTime: number;

  @Transform(stringValue)
  @IsString()
  @MaxLength(1000)
  extraData: string;

  @Transform(stringValue)
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  signature: string;
}
