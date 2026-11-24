import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProviderServiceAvailabilityDto {
  @ApiProperty({
    example: false,
    description: 'Bật hoặc tạm ngừng nhận đơn mới.',
  })
  @IsBoolean()
  active: boolean;
}

export class SuspendProviderServiceDto {
  @ApiProperty({ example: 'Dịch vụ cần xác minh thêm chứng chỉ nghề.' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
