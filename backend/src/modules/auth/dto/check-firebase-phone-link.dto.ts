import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';

export class CheckFirebasePhoneLinkDto {
  @IsString()
  @MinLength(100)
  @MaxLength(4096)
  idToken!: string;

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
