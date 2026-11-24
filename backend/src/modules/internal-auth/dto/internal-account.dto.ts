import { Type } from 'class-transformer';
import { InternalAccountStatus, InternalRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
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

export class CreateInternalAccountDto {
  @ApiProperty({ example: 'reviewer01' })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9._-]{2,63}$/)
  username: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'reviewer@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: InternalRole, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(InternalRole, { each: true })
  roles: InternalRole[];
}

export class UpdateInternalAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class ReplaceInternalRolesDto {
  @ApiProperty({ enum: InternalRole, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(InternalRole, { each: true })
  roles: InternalRole[];
}

export class InternalAccountQueryDto {
  @ApiPropertyOptional({ enum: InternalAccountStatus })
  @IsOptional()
  @IsEnum(InternalAccountStatus)
  status?: InternalAccountStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
