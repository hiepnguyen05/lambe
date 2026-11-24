import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class FinanceRangeDto {
  @ApiProperty({
    format: 'date-time',
    description:
      'Inclusive completedAt, ISO có timezone. Khoảng tối đa 93 ngày.',
  })
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  from: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Exclusive completedAt; không bao gồm đơn chờ/hủy/tranh chấp.',
  })
  @IsDateString({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  to: string;
}

export class OwnerFinanceQueryDto extends FinanceRangeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Lọc người thực hiện, gồm lịch sử các version của member trong tổ chức.',
  })
  @IsOptional()
  @IsUUID('4')
  memberId?: string;
}

export class FinanceOrdersQueryDto extends FinanceRangeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'nextCursor của trang trước, giữ nguyên bộ lọc.',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class OwnerFinanceOrdersQueryDto extends FinanceOrdersQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  memberId?: string;
}

export class FinanceMembersQueryDto extends FinanceRangeDto {
  @ApiPropertyOptional({
    description:
      'Cursor nhóm member:version hoặc LEGACY từ nextCursor; không sửa bộ lọc giữa trang.',
  })
  @IsOptional()
  @Matches(
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:[1-9]\d{0,8}|LEGACY)$/i,
  )
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
