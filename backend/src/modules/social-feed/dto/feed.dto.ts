import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FeedReportReason,
  FeedReportResolution,
  FeedPostStatus,
  FeedOrganizationReviewStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { FEED_POLICY_CODES } from './feed-moderation.dto';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const multipartBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
const multipartIds = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export class CreateFeedPostDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Membership của chính người đăng để chọn ngữ cảnh tổ chức; không phải ID tác giả tùy ý.',
  })
  @IsOptional()
  @IsUUID('4')
  memberId?: string;
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  caption: string;

  @ApiProperty({
    type: [String],
    description:
      'JSON array khi gửi multipart/form-data, tối đa 5 dịch vụ của chính đối tác',
  })
  @Transform(multipartIds)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  providerServiceIds: string[];

  @ApiProperty({ type: Boolean })
  @Transform(multipartBoolean)
  @IsBoolean()
  includesCustomer: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Bắt buộc true nếu bài có hình ảnh/nhận diện khách hàng',
  })
  @Transform(multipartBoolean)
  @IsBoolean()
  hasCustomerConsent: boolean;
}

export class UpdateFeedPostDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Nếu gửi, phải khớp revisionNumber hiện tại.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  revisionNumber?: number;
  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  caption?: string;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  providerServiceIds?: string[];
}

export class FeedIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}

export class FeedListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  providerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Lọc bài viết gắn dịch vụ thuộc danh mục theo ID',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Lọc bài viết gắn dịch vụ thuộc danh mục theo slug',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Tìm kiếm theo nội dung bài viết, tên chuyên viên hoặc dịch vụ',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID cuối trang trước' })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class FeedCommentsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ManagedFeedQueryDto extends FeedListQueryDto {
  @ApiPropertyOptional({ enum: FeedOrganizationReviewStatus })
  @IsOptional()
  @IsEnum(FeedOrganizationReviewStatus)
  organizationReviewStatus?: FeedOrganizationReviewStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  authorMemberId?: string;
}

export class ReviewOrganizationFeedPostDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsString()
  @IsEnum({ APPROVE: 'APPROVE', REJECT: 'REJECT' })
  decision: 'APPROVE' | 'REJECT';

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revisionNumber: number;

  @ApiPropertyOptional({
    minLength: 5,
    maxLength: 500,
    description:
      'Bắt buộc khi từ chối hoặc ẩn bài; lý do chỉ owner/tác giả được đọc.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note?: string;
}

export class FeedReportsQueryDto {
  @ApiPropertyOptional({ default: false })
  @Transform(multipartBoolean)
  @IsOptional()
  @IsBoolean()
  reviewed = false;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}

export class CreateFeedCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Chỉ cho phép trả lời bình luận gốc',
  })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}

export class ReportFeedPostDto {
  @ApiProperty({ enum: FeedReportReason })
  @IsEnum(FeedReportReason)
  reason: FeedReportReason;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}

export class ModerateFeedPostDto {
  @ApiProperty({ enum: [FeedPostStatus.PUBLISHED, FeedPostStatus.HIDDEN] })
  @IsEnum(FeedPostStatus)
  status: FeedPostStatus;
}

export class AdminFeedPostsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: ['ALL', 'PUBLISHED', 'HIDDEN', 'DELETED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED'])
  moderationStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(multipartBoolean)
  @IsOptional()
  @IsBoolean()
  hasReports?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  providerId?: string;
}

export class ResolveFeedReportDto {
  @IsOptional() @IsIn(FEED_POLICY_CODES) policyCode?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note?: string;
  @ApiProperty({ enum: FeedReportResolution })
  @IsEnum(FeedReportResolution)
  resolution: FeedReportResolution;
}
