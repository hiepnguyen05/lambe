import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateCurrentUserProfileDto {
  @ApiPropertyOptional({
    example: 'Nguyen Minh Anh',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }) => {
    const input = value as unknown;
    return typeof input === 'string' ? input.trim() : input;
  })
  @IsOptional()
  @IsString({ message: 'Ho ten phai la chuoi ky tu' })
  @Length(2, 100, { message: 'Ho ten phai co tu 2 den 100 ky tu' })
  fullName?: string;

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsEnum(Gender, { message: 'Gioi tinh khong hop le' })
  gender?: Gender | null;
}
