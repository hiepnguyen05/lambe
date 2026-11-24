import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProviderWorkingHourDto } from '../../providers/dto/provider-setup.dto';
import { ProviderLocationDto } from '../../providers/dto/provider-location.dto';
import { ProviderMembersQueryDto } from './provider-members.dto';

export class MemberChangeReasonDto {
  @ApiPropertyOptional({
    description: 'Bắt buộc khi owner sửa lịch/nghỉ phép của thành viên khác.',
    minLength: 5,
    maxLength: 300,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason?: string;
}

export class AssignMemberServicesDto extends MemberChangeReasonDto {
  @ApiProperty({
    type: [String],
    description:
      'Danh sách đầy đủ ProviderService ID được cấp; [] thu hồi toàn bộ. Không có giá riêng theo worker.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  providerServiceIds!: string[];
}

export class MemberWorkingHoursDto extends MemberChangeReasonDto {
  @ApiProperty({
    type: [ProviderWorkingHourDto],
    description:
      'Thay toàn bộ lịch hiện hành; [] nghỉ toàn bộ tuần. Múi giờ Asia/Ho_Chi_Minh.',
  })
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ProviderWorkingHourDto)
  workingHours!: ProviderWorkingHourDto[];
}

export class MemberTimeOffDto extends MemberChangeReasonDto {
  @ApiProperty({
    format: 'date-time',
    description: 'ISO 8601 có timezone, bắt đầu không trong quá khứ.',
  })
  @IsDateString({ strict: true })
  startAt!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Sau startAt, tối đa 90 ngày/lần nghỉ.',
  })
  @IsDateString({ strict: true })
  endAt!: string;
}

export class MemberTimeOffQueryDto extends ProviderMembersQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Mặc định hiện tại; cửa sổ truy vấn tối đa 366 ngày.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class MemberReceivingSettingsDto {
  @ApiProperty({
    minimum: 1,
    maximum: 50,
    description: 'Bán kính nhận đơn (km), không vượt bán kính tổ chức.',
  })
  @IsInt()
  @Min(1)
  @Max(50)
  receivingRadiusKm!: number;
}

export class MemberOnlineDto extends ProviderLocationDto {
  @ApiProperty({
    format: 'date-time',
    description:
      'Thời điểm thiết bị lấy GPS, tối đa 60 giây trước hoặc 15 giây sau giờ server.',
  })
  @IsDateString({ strict: true })
  capturedAt!: string;
}

export class MemberHeartbeatDto extends MemberOnlineDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'ID phiên do online trả về. Phiên hết hạn không được heartbeat hồi sinh.',
  })
  @IsUUID('4')
  sessionId!: string;
}

export class MemberOfflineDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID phiên muốn tắt, tránh request cũ tắt nhầm phiên mới.',
  })
  @IsUUID('4')
  sessionId!: string;
}

export class OrganizationMemberReceivingDto {
  @ApiProperty({
    description:
      'Bật/tạm dừng nhận đơn mới qua thành viên của tổ chức, không hủy đơn đã nhận.',
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ minLength: 5, maxLength: 300 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}
