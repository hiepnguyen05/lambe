import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ExchangeFirebaseTokenDto {
  @ApiProperty({
    description: 'Firebase ID token returned after phone OTP verification',
  })
  @IsString()
  @MinLength(100)
  @MaxLength(4096)
  idToken!: string;
}
