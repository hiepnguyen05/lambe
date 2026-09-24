import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CompleteRegistrationDto {
  @IsNotEmpty({ message: 'Registration token không được để trống' })
  @IsString({ message: 'Registration token phải là chuỗi ký tự' })
  registrationToken: string;

  @Transform(({ value }) => {
    const input = value as unknown;
    return typeof input === 'string' ? input.trim() : input;
  })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @Length(2, 100, { message: 'Họ và tên phải có từ 2 đến 100 ký tự' })
  fullName: string;
}
