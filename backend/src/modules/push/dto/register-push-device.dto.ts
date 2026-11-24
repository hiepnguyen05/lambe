import { PushPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterPushDeviceDto {
  @ApiProperty({ enum: PushPlatform, example: PushPlatform.ANDROID })
  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @ApiProperty({
    description: 'Mã cài đặt ứng dụng ổn định trên thiết bị.',
    example: 'f532936a-793e-49cf-ab0e-f6f7c28ce583',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/)
  deviceId!: string;

  @ApiProperty({ description: 'FCM registration token của chính thiết bị.' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;
}
