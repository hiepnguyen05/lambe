import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProviderWorkingHourDto {
  @ApiProperty({
    minimum: 0,
    maximum: 6,
    description:
      '0: Chủ nhật, 1: Thứ hai, ... 6: Thứ bảy. Giờ Việt Nam (Asia/Ho_Chi_Minh).',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: 480, minimum: 0, maximum: 1439 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @ApiProperty({ example: 1020, minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute: number;
}

export class ProviderSetupDto {
  @ApiProperty({ example: 'Quận Cầu Giấy, Hà Nội' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  serviceAreaName: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  serviceRadiusKm: number;

  @ApiProperty({ type: [ProviderWorkingHourDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ProviderWorkingHourDto)
  workingHours: ProviderWorkingHourDto[];

  @ApiProperty({
    type: [String],
    description:
      'ID của các ProviderService đã được duyệt, không phải ID danh mục dịch vụ.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  enabledServiceIds: string[];
}
