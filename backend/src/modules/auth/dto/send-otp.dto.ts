import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { VIETNAMESE_PHONE_PATTERN } from '../../../common/constants/validation.constants';

export class SendOtpDto {
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @Matches(VIETNAMESE_PHONE_PATTERN, {
    message: 'Số điện thoại không đúng định dạng Việt Nam',
  })
  phone: string;
}
