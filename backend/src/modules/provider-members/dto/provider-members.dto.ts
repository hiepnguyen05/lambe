import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { normalizeVietnamesePhone } from '../../../common/utils/phone.util';

export class CreateProviderMemberInvitationDto {
  @ApiProperty({
    example: '0912345678',
    description: 'SĐT người được mời. Chấp nhận 0, +84 hoặc 84; lưu dạng 0.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeVietnamesePhone(value) : value,
  )
  @IsString()
  @Matches(/^0[35789][0-9]{8}$/)
  phone!: string;
}

export class RespondProviderMemberInvitationDto {
  @ApiProperty({
    description:
      'Token 64 ký tự hex nhận từ owner. Token chỉ dùng một lần và phải đúng SĐT tài khoản đăng nhập.',
    example: 'a'.repeat(64),
    writeOnly: true,
  })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  token!: string;
}

export class ProviderMembersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
