import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ProviderDocumentQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Dịch vụ liên quan, dùng cho chứng chỉ hoặc portfolio',
  })
  @IsUUID('4')
  @IsOptional()
  applicationServiceId?: string;
}
