import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeServiceSlug } from './service-transformers';

export class ServiceSlugParamDto {
  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  slug: string;
}
