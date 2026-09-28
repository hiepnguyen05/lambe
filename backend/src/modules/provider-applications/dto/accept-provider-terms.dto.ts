import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';

export class AcceptProviderTermsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsIn([true], {
    message: 'Bạn phải đồng ý điều khoản dành cho nhà cung cấp.',
  })
  accepted: true;
}
