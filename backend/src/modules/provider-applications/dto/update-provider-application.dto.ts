import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimOptionalString } from './provider-transformers';

export class UpdateProviderApplicationDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  legalFullName?: string | null;

  @ApiPropertyOptional({ example: '1995-08-20', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày sinh phải có định dạng YYYY-MM-DD.',
  })
  @IsOptional()
  birthDate?: string | null;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender | null;

  @ApiPropertyOptional({ example: 'provider@example.com' })
  @Transform(trimOptionalString)
  @IsEmail()
  @MaxLength(254)
  @IsOptional()
  email?: string | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  biography?: string | null;

  @ApiPropertyOptional({ example: '001095012345' })
  @Transform(trimOptionalString)
  @Matches(/^\d{12}$/, { message: 'Số CCCD phải gồm đúng 12 chữ số.' })
  @IsOptional()
  nationalIdNumber?: string | null;

  @ApiPropertyOptional({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  @IsOptional()
  experienceYears?: number | null;

  @ApiPropertyOptional({ example: 'Lambe Beauty Studio' })
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @IsOptional()
  organizationName?: string | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30)
  @IsOptional()
  taxCode?: string | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  businessRegistrationNumber?: string | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  @IsOptional()
  registeredAddress?: string | null;

  @ApiPropertyOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  representativeName?: string | null;
}
