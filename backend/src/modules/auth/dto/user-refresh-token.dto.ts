import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UserRefreshTokenDto {
  @ApiProperty({
    description:
      'Refresh token Lambe. Ứng dụng mobile phải lưu bằng secure storage.',
  })
  @IsString()
  @MinLength(100)
  @MaxLength(512)
  refreshToken!: string;
}
