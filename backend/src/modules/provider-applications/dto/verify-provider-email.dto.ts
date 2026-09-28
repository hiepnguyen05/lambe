import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class VerifyProviderEmailDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;
}
