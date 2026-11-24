import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const FEED_POLICY_CODES = [
  'SEXUAL_OR_NUDITY',
  'PRIVACY_OR_NO_CONSENT',
  'MISLEADING_OR_MEDICAL_CLAIM',
  'SPAM_OR_SCAM',
  'VIOLENCE_OR_GRAPHIC',
  'COPYRIGHT_OR_REUPLOAD',
  'OTHER',
] as const;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ReviewFeedDto {
  @IsOptional() @IsBoolean() blockMedia?: boolean;
  @IsInt() @Min(1) revisionNumber: number;
  @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @IsBoolean() eligible: boolean;
  @IsOptional() @IsIn(FEED_POLICY_CODES) policyCode?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note?: string;
}
export class AppealFeedDto {
  @IsInt() @Min(1) revisionNumber: number;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(1000) reason: string;
}
export class ResolveFeedAppealDto {
  @IsIn(['UPHELD', 'REVERSED']) decision: 'UPHELD' | 'REVERSED';
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) note: string;
}
export class FeedCommentDecisionDto {
  @IsBoolean() hide: boolean;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) note: string;
}
export class FeedPostingRestrictionDto {
  @IsBoolean() blocked: boolean;
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) note: string;
}
