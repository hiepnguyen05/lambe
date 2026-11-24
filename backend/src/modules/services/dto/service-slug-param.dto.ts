import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeSlug as normalizeServiceSlug } from '../../../common/validation/string-transformers';

export class ServiceSlugParamDto {
  @ApiProperty({ example: 'cat-toc-nam' })
  @Transform(normalizeServiceSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(2)
  @MaxLength(120)
  slug: string;
}
