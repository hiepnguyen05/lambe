import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min, ValidateIf } from 'class-validator';

export class ServiceEvidenceRequirementsDto {
  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  requiresCertificate?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 20 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(20)
  minPortfolioImages?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 80 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(80)
  minExperienceYears?: number;
}
