import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Gender,
  ProviderDocumentType,
  ProviderMemberVerificationStatus,
  ProviderMemberStatus,
  ReviewStatus,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProviderMembersQueryDto } from './provider-members.dto';
import {
  MEMBER_DOCUMENT_TYPES,
  MEMBER_TERMS_VERSION,
} from '../domain/member-verification.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SaveProviderMemberVerificationDto {
  @ApiProperty({ example: 'Nguyễn Văn An' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  legalFullName!: string;

  @ApiProperty({ example: '1995-08-20', format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate!: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '001095012345', writeOnly: true })
  @IsString()
  @Matches(/^\d{12}$/)
  nationalIdNumber!: string;

  @ApiProperty({ example: 3, minimum: 0, maximum: 80 })
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears!: number;

  @ApiProperty({
    type: [String],
    description:
      'ProviderService IDs của tổ chức để xét chuyên môn; chưa phải cấp quyền nhận đơn.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  requestedProviderServiceIds!: string[];

  @ApiProperty({ example: MEMBER_TERMS_VERSION })
  @Equals(MEMBER_TERMS_VERSION)
  termsVersion!: string;

  @ApiProperty({ example: true })
  @Equals(true)
  acceptedTerms!: boolean;
}

export class ProviderMemberDocumentQueryDto {
  @ApiProperty({ enum: MEMBER_DOCUMENT_TYPES })
  @IsIn(MEMBER_DOCUMENT_TYPES)
  type!: ProviderDocumentType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Bắt buộc với chứng chỉ; chỉ được liên kết dịch vụ đã chọn của tổ chức.',
  })
  @IsUUID('4')
  @IsOptional()
  providerServiceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Thay đúng tài liệu cần bổ sung; giữ tài liệu cũ trong lịch sử.',
  })
  @IsUUID('4')
  @IsOptional()
  replacesDocumentId?: string;

  @ApiPropertyOptional({
    example: '2028-12-31T16:59:59Z',
    description: 'Chỉ dùng cho chứng chỉ; không có ngày hết hạn thì bỏ trống.',
  })
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  @IsOptional()
  expiresAt?: string;
}

export class MemberVerificationRevisionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID hồ sơ xác minh hiện hành; đổi khi rời rồi gia nhập lại.',
  })
  @IsUUID('4')
  verificationId!: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  revisionNumber!: number;
}

export class ReviewProviderMemberDocumentDto extends MemberVerificationRevisionDto {
  @ApiProperty({
    enum: [
      ReviewStatus.VERIFIED,
      ReviewStatus.NEEDS_CHANGES,
      ReviewStatus.REJECTED,
    ],
  })
  @IsIn([
    ReviewStatus.VERIFIED,
    ReviewStatus.NEEDS_CHANGES,
    ReviewStatus.REJECTED,
  ])
  status!: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Bắt buộc ít nhất 5 ký tự khi cần bổ sung/từ chối.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  @IsOptional()
  reviewNote?: string;
}

export class DecideProviderMemberVerificationDto extends MemberVerificationRevisionDto {
  @ApiPropertyOptional({
    description: 'Bắt buộc khi yêu cầu bổ sung hoặc từ chối hồ sơ.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  @IsOptional()
  reason?: string;
}

export class ProviderMemberLifecycleDto {
  @ApiProperty({ example: 'Tạm đình chỉ để xác minh phản ánh về tài khoản.' })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class ProviderMemberIdentityAccessDto extends ProviderMemberLifecycleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  verificationId!: string;
}

export class ReopenProviderMemberVerificationDto extends ProviderMemberLifecycleDto {
  @ApiProperty({
    type: [String],
    description:
      'Các tài liệu hiện hành cần cập nhật/gia hạn, giữ nguyên những giấy tờ còn lại.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  documentIds!: string[];
}

export class ProviderMemberVerificationQueryDto extends ProviderMembersQueryDto {
  @ApiPropertyOptional({ enum: ProviderMemberVerificationStatus })
  @IsEnum(ProviderMemberVerificationStatus)
  @IsOptional()
  status?: ProviderMemberVerificationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  providerId?: string;
}

export class ProviderMemberOperationsQueryDto extends ProviderMembersQueryDto {
  @ApiPropertyOptional({ enum: ProviderMemberStatus })
  @IsEnum(ProviderMemberStatus)
  @IsOptional()
  status?: ProviderMemberStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  providerId?: string;
}
