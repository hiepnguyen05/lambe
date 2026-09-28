import { ApiProperty } from '@nestjs/swagger';
import { ProviderType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateProviderApplicationDto {
  @ApiProperty({ enum: ProviderType, example: ProviderType.INDIVIDUAL })
  @IsEnum(ProviderType)
  providerType: ProviderType;
}
