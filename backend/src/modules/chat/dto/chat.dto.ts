import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageKind, ChatReportReason } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  Equals,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class StartChatDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  providerId: string;

  @ApiPropertyOptional({ enum: ['TEXT'] })
  @IsOptional()
  @Equals(ChatMessageKind.TEXT)
  kind?: 'TEXT';

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientMessageId: string;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}

export class SendChatMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientMessageId: string;

  @ApiProperty({ enum: ['TEXT', 'SERVICE_CARD'] })
  @IsEnum(ChatMessageKind)
  kind: ChatMessageKind;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  providerServiceId?: string;
}

export class SendChatImagesDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID duy nhất do client tạo để retry không sinh tin trùng.',
  })
  @IsUUID('4')
  clientMessageId: string;
}

export class ChatIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class InboxQueryDto {
  @ApiProperty({ enum: ['customer', 'provider'] })
  @IsEnum(['customer', 'provider'])
  view: 'customer' | 'provider';

  @ApiPropertyOptional({ description: 'Opaque cursor từ meta.nextCursor' })
  @IsString()
  @MaxLength(256)
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}

export class ChatMessagesQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  beforeSequence?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  afterSequence?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export class ChatEventsQueryDto {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Sequence cuối đã nhận; kết nối lại từ tin nhắn tiếp theo.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  afterSequence?: number;
}

export class MarkChatReadDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  lastReadSequence: number;
}

export class ReportChatDto {
  @ApiProperty({ enum: ChatReportReason })
  @IsEnum(ChatReportReason)
  reason: ChatReportReason;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  messageId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  detail?: string;
}
