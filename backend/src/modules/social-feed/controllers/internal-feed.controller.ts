import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import { FeedModerationService } from '../application/feed-moderation.service';
import { FeedReviewService } from '../application/feed-review.service';
import { FeedOperationsService } from '../application/feed-operations.service';
import {
  FeedCommentDecisionDto,
  FeedPostingRestrictionDto,
} from '../dto/feed-moderation.dto';
import {
  ReviewFeedDto,
  ResolveFeedAppealDto,
} from '../dto/feed-moderation.dto';
import { FeedCommentsQueryDto } from '../dto/feed.dto';
import {
  AdminFeedPostsQueryDto,
  FeedIdParamDto,
  FeedReportsQueryDto,
  ModerateFeedPostDto,
  ResolveFeedReportDto,
} from '../dto/feed.dto';

@ApiTags('Beauty Feed Moderation')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.MODERATOR)
@Controller('internal/feed')
export class InternalFeedController {
  constructor(
    private readonly moderation: FeedModerationService,
    private readonly reviews: FeedReviewService,
    private readonly operations: FeedOperationsService,
  ) {}

  @Get('operations') operationsStatus() {
    return this.operations.metrics();
  }
  @Get('comment-reports') commentReports() {
    return this.operations.commentReports();
  }
  @Patch('comment-reports/:id') resolveComment(
    @Param() param: FeedIdParamDto,
    @Body() dto: FeedCommentDecisionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.operations.resolveComment(
      param.id,
      dto.hide,
      dto.note,
      account.accountId,
    );
  }
  @Patch('providers/:id/posting-restriction')
  @InternalRoles(InternalRole.ADMIN)
  restrict(
    @Param() param: FeedIdParamDto,
    @Body() dto: FeedPostingRestrictionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.operations.restrict(
      param.id,
      dto.blocked,
      dto.note,
      account.accountId,
    );
  }

  @Get('review-queue')
  queue(@Query() query: FeedCommentsQueryDto) {
    return this.reviews.queue(query);
  }

  @Patch('posts/:id/review')
  review(
    @Param() param: FeedIdParamDto,
    @Body() dto: ReviewFeedDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.reviews.review(param.id, dto, account.accountId);
  }

  @Get('posts/:id/review-history')
  history(@Param() param: FeedIdParamDto) {
    return this.reviews.history(param.id);
  }

  @Get('appeals')
  appeals() {
    return this.reviews.appeals();
  }

  @Patch('appeals/:id')
  resolveAppeal(
    @Param() param: FeedIdParamDto,
    @Body() dto: ResolveFeedAppealDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.reviews.resolveAppeal(param.id, dto, account.accountId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê tổng quan Feed' })
  stats() {
    return this.moderation.stats();
  }

  @Get('posts')
  @ApiOperation({ summary: 'Danh sách bài đăng trên Feed dành cho quản trị' })
  posts(@Query() query: AdminFeedPostsQueryDto) {
    return this.moderation.posts(query);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Danh sách báo cáo bài đăng mới nhất' })
  reports(@Query() query: FeedReportsQueryDto) {
    return this.moderation.reports(query.limit, query.reviewed);
  }

  @Patch('posts/:id/status')
  @ApiOperation({
    summary: 'Ẩn hoặc hiện lại bài; không khôi phục bài đối tác đã xóa',
  })
  status(
    @Param() param: FeedIdParamDto,
    @Body() dto: ModerateFeedPostDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.moderation.setStatus(param.id, dto.status, account.accountId);
  }

  @Patch('reports/:id')
  @ApiOperation({
    summary: 'Giải quyết báo cáo: bỏ qua hoặc ẩn bài, ghi người xử lý',
  })
  resolve(
    @Param() param: FeedIdParamDto,
    @Body() dto: ResolveFeedReportDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.moderation.resolveReport(
      param.id,
      dto.resolution,
      account.accountId,
      dto.policyCode,
      dto.note,
    );
  }
}
