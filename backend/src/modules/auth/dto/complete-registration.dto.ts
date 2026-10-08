import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CompleteRegistrationDto {
  @ApiProperty({
    description:
      'Token đăng ký tạm thời backend trả về sau khi xác minh Firebase nhưng tài khoản còn thiếu hồ sơ.',
  })
  @IsNotEmpty({ message: 'Registration token không được để trống' })
  @IsString({ message: 'Registration token phải là chuỗi ký tự' })
  registrationToken: string;

  @ApiProperty({ example: 'Nguyen Minh Anh', minLength: 2, maxLength: 100 })
  @Transform(({ value }) => {
    const input = value as unknown;
    return typeof input === 'string' ? input.trim() : input;
  })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @Length(2, 100, { message: 'Họ và tên phải có từ 2 đến 100 ký tự' })
  fullName: string;
}
