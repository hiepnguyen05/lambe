import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SePayIpnOrderDto {
  @Allow()
  id?: unknown;

  @Allow()
  order_id?: unknown;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @MaxLength(100)
  order_invoice_number: string;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @MaxLength(30)
  order_amount: string;

  @IsString()
  @IsIn(['VND'])
  order_currency: string;

  @IsString()
  @MaxLength(50)
  order_status: string;

  @Allow()
  order_description?: unknown;

  @Allow()
  user_agent?: unknown;

  @Allow()
  ip_address?: unknown;

  @IsOptional()
  @Allow()
  custom_data?: unknown;
}

export class SePayIpnTransactionDto {
  @Allow()
  id?: unknown;

  @Allow()
  payment_method?: unknown;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @MaxLength(100)
  transaction_id: string;

  @Transform(({ value }: { value: unknown }) => String(value))
  @IsString()
  @MaxLength(30)
  transaction_amount: string;

  @IsString()
  @IsIn(['VND'])
  transaction_currency: string;

  @IsString()
  @MaxLength(50)
  transaction_status: string;

  @IsString()
  @MaxLength(50)
  transaction_type: string;

  @Allow()
  transaction_date?: unknown;

  @Allow()
  authentication_status?: unknown;

  @Allow()
  card_number?: unknown;

  @Allow()
  card_holder_name?: unknown;

  @Allow()
  card_expiry?: unknown;

  @Allow()
  card_funding_method?: unknown;

  @Allow()
  card_brand?: unknown;
}

export class SePayIpnDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timestamp: number;

  @IsString()
  @IsIn(['ORDER_PAID', 'PAYMENT_SUCCESS', 'TRANSACTION_VOID'])
  notification_type: 'ORDER_PAID' | 'PAYMENT_SUCCESS' | 'TRANSACTION_VOID';

  @ValidateNested()
  @Type(() => SePayIpnOrderDto)
  order: SePayIpnOrderDto;

  @ValidateNested()
  @Type(() => SePayIpnTransactionDto)
  transaction: SePayIpnTransactionDto;

  @Allow()
  customer?: unknown;

  @Allow()
  agreement?: unknown;
}
