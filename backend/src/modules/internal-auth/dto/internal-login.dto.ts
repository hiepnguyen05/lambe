import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  MAX_INTERNAL_PASSWORD_LENGTH,
  MIN_INTERNAL_PASSWORD_LENGTH,
} from '../constants/password.constants';

export class InternalLoginDto {
  @ApiProperty({ example: 'admin', minLength: 3, maxLength: 64 })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    minLength: MIN_INTERNAL_PASSWORD_LENGTH,
    maxLength: MAX_INTERNAL_PASSWORD_LENGTH,
  })
  @IsString()
  @MinLength(MIN_INTERNAL_PASSWORD_LENGTH)
  @MaxLength(MAX_INTERNAL_PASSWORD_LENGTH)
  password: string;
}
