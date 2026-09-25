import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  MAX_INTERNAL_PASSWORD_LENGTH,
  MIN_INTERNAL_PASSWORD_LENGTH,
} from '../constants/password.constants';

export class InternalLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(MIN_INTERNAL_PASSWORD_LENGTH)
  @MaxLength(MAX_INTERNAL_PASSWORD_LENGTH)
  password: string;
}
