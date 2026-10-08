import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';

export class CheckFirebasePhoneLinkDto {
  @ApiProperty({
    description: 'Firebase ID token của tài khoản social cần liên kết SĐT.',
  })
  @IsString()
  @MinLength(100)
  @MaxLength(4096)
  idToken!: string;

  @ApiProperty({
    example: '0912345678',
    description: 'Số điện thoại cần kiểm tra trước khi gửi OTP Firebase.',
  })
  @Transform(({ value }) => {
    const input = value as unknown;
    return typeof input === 'string' ? normalizeVietnamesePhone(input) : input;
  })
  @IsString()
  @Matches(/^0[35789][0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phone!: string;
}
