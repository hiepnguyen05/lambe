import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum UploadFolder {
  GENERAL = 'general',
  CATEGORIES = 'categories',
  PROFILES = 'profiles',
  PORTFOLIOS = 'portfolios',
}

export class UploadImageQueryDto {
  @ApiPropertyOptional({ enum: UploadFolder, default: UploadFolder.GENERAL })
  @IsOptional()
  @IsEnum(UploadFolder)
  folder: UploadFolder = UploadFolder.GENERAL;
}
