import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingType,
  OrderCancellationReason,
  ServiceOrderStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { VIETNAMESE_PHONE_PATTERN } from '../../../common/constants/validation.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class InlineOrderAddressDto {
  @ApiProperty({ example: 'Địa chỉ đặt dịch vụ' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: '12 Nguyễn Huệ, Quận 1, TP.HCM' })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine: string;

  @ApiProperty()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  provinceName?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  districtName?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  wardName?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(250)
  @IsOptional()
  streetLine?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}

export class OrderQuoteDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Nhân viên đã chọn; bắt buộc với tổ chức, không gửi cho đối tác cá nhân.',
  })
  @IsUUID('4')
  @IsOptional()
  memberId?: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  providerServiceId: string;

  @ApiPropertyOptional({
    example: 'LAMBE30',
    description: 'Một mã voucher cho mỗi đơn.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @Matches(/^[A-Z0-9_-]{4,32}$/)
  voucherCode?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Chọn địa chỉ đã lưu hoặc inlineAddress.',
  })
  @IsUUID('4')
  @IsOptional()
  customerAddressId?: string;

  @ApiPropertyOptional({ type: () => InlineOrderAddressDto })
  @ValidateNested()
  @Type(() => InlineOrderAddressDto)
  @IsOptional()
  inlineAddress?: InlineOrderAddressDto;

  @ApiProperty({ enum: BookingType, example: BookingType.ASAP })
  @IsEnum(BookingType)
  bookingType: BookingType;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-10-09T18:00:00+07:00',
    description: 'Bắt buộc với SCHEDULED và phải để trống với ASAP.',
  })
  @ValidateIf(
    (dto: OrderQuoteDto) =>
      dto.bookingType === BookingType.SCHEDULED ||
      dto.scheduledAt !== undefined,
  )
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledAt?: string;
}

export class CreateOrderDto extends OrderQuoteDto {
  @ApiProperty({ description: 'Báo giá còn hạn từ POST /orders/quote.' })
  @IsString()
  @MinLength(100)
  @MaxLength(2000)
  quoteToken: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @Transform(trim)
  @Matches(VIETNAMESE_PHONE_PATTERN)
  @IsOptional()
  contactPhone?: string;
  @ApiPropertyOptional({ example: 'Vui lòng gọi trước khi đến.' })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  customerNote?: string;
}

export class RequestOrderCancellationDto {
  @ApiProperty({ enum: OrderCancellationReason })
  @IsEnum(OrderCancellationReason)
  reason: OrderCancellationReason;

  @ApiProperty({ example: 'Không thể đến địa chỉ vì đường bị phong tỏa.' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  detail: string;
}

export class DecideOrderCancellationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class CreateOrderReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  comment?: string;
}

export class RejectOrderDto {
  @ApiProperty({ example: 'Không thể phục vụ trong khung giờ này.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Tôi không còn nhu cầu sử dụng dịch vụ.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class CompleteOrderDto {
  @ApiProperty({
    example: true,
    description: 'Thợ chỉ xác nhận true sau khi đã nhận đủ tiền mặt từ khách.',
  })
  @IsBoolean()
  @Equals(true)
  cashReceived: true;
}

export class OpenPaymentDisputeDto {
  @ApiProperty({
    example: 'Khách chưa thanh toán đủ tiền mặt sau khi hoàn thành dịch vụ.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}

export class RequestOrderRescheduleDto {
  @ApiProperty({ format: 'date-time', example: '2026-10-25T14:00:00+07:00' })
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledAt: string;
}

export class DecideOrderRescheduleDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'ID yêu cầu thợ đang xem; truyền để tránh quyết định nhầm yêu cầu mới thay thế.',
  })
  @IsOptional()
  @IsUUID('4')
  requestId?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  approve: boolean;
}

export class DecidePaymentDisputeDto {
  @ApiProperty({ enum: ['CONFIRM_PAID', 'CONFIRM_UNPAID'] })
  @IsIn(['CONFIRM_PAID', 'CONFIRM_UNPAID'])
  decision: 'CONFIRM_PAID' | 'CONFIRM_UNPAID';

  @ApiProperty({ example: 'Đã đối chiếu trao đổi giữa khách và thợ.' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  note: string;
}

export class CloseUnpaidPaymentDisputeDto {
  @ApiProperty({
    example: 'Khách không thanh toán sau khi bộ phận hỗ trợ đối chiếu.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  note: string;
}

export class OrderQueryDto {
  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsEnum(ServiceOrderStatus)
  @IsOptional()
  status?: ServiceOrderStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID cuối của trang trước.',
  })
  @IsUUID('4')
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class OrderParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}
