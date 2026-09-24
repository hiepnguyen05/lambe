import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  OTP_PATTERN,
  VIETNAMESE_PHONE_PATTERN,
} from '../../../common/constants/validation.constants';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @Matches(VIETNAMESE_PHONE_PATTERN, {
    message: 'Số điện thoại không đúng định dạng Việt Nam',
  })
  phone: string;

  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @IsString({ message: 'Mã OTP phải là chuỗi' })
  @Matches(OTP_PATTERN, { message: 'Mã OTP phải đúng 6 chữ số' })
  code: string;
}
