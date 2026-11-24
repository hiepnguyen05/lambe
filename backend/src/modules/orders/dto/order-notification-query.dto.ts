import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class OrderNotificationQueryDto {
  @ApiPropertyOptional({ description: 'ID thông báo cuối của trang trước.' })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class OrderNotificationStreamQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID sự kiện cuối đã nhận.',
  })
  @IsOptional()
  @IsUUID('4')
  after?: string;
}
