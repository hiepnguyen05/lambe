import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  MAX_INTERNAL_PASSWORD_LENGTH,
  MIN_INTERNAL_PASSWORD_LENGTH,
} from '../constants/password.constants';

export class ActivateInternalAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(MIN_INTERNAL_PASSWORD_LENGTH)
  @MaxLength(MAX_INTERNAL_PASSWORD_LENGTH)
  password: string;
}

export class ChangeInternalPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(MIN_INTERNAL_PASSWORD_LENGTH)
  @MaxLength(MAX_INTERNAL_PASSWORD_LENGTH)
  newPassword: string;
}
