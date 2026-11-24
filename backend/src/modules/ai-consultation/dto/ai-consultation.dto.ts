import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiFeedbackReason, BookingType } from '@prisma/client';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ConversationParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class ConsultationRecommendationParamDto extends ConversationParamDto {
  @ApiProperty({
    format: 'uuid',
    description: 'clientMessageId của tin nhắn user đã nhận phản hồi',
  })
  @IsUUID('4')
  clientMessageId: string;
}

export class ConsultationMessageDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientMessageId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  customerAddressId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: BookingType })
  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((dto: ConsultationMessageDto) => dto.scheduledAt !== undefined)
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  scheduledAt?: string;
}

export class ConsultationActionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientMessageId: string;

  @ApiProperty({
    enum: [
      'VIEW_INSPIRATION',
      'VIEW_SERVICE',
      'FIND_PROVIDER',
      'CREATE_QUOTE',
      'SELECT_ADDRESS',
      'SELECT_BOOKING_TIME',
    ],
  })
  @IsIn([
    'VIEW_INSPIRATION',
    'VIEW_SERVICE',
    'FIND_PROVIDER',
    'CREATE_QUOTE',
    'SELECT_ADDRESS',
    'SELECT_BOOKING_TIME',
  ])
  type: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  targetId?: string;
}

export class AiFeedbackDto {
  @ApiProperty()
  @IsBoolean()
  helpful: boolean;

  @ApiPropertyOptional({ enum: AiFeedbackReason })
  @IsOptional()
  @IsEnum(AiFeedbackReason)
  reason?: AiFeedbackReason;
}
