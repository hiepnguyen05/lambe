import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { FeedQueryService } from '../application/feed-query.service';
import { OrganizationFeedReviewService } from '../application/organization/organization-feed-review.service';
import { FeedIdParamDto, ReviewOrganizationFeedPostDto } from '../dto/feed.dto';
import { managedFeedPostExample } from './feed.examples';

@ApiTags('Organization Feed Management')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/feed/posts')
export class OrganizationFeedController {
  constructor(
    private readonly queries: FeedQueryService,
    private readonly review: OrganizationFeedReviewService,
  ) {}

  @Get(':id/manage')
  @ApiOperation({
    summary: 'Đọc bài quản lý và lý do duyệt nội bộ, kể cả bài chưa công khai',
    description:
      'Owner đọc bài của tổ chức; worker chỉ đọc bài của chính membership/version hiện tại. organizationReview=null status là legacy/cá nhân chưa cần duyệt; không trả metadata này qua API công khai.',
  })
  @ApiStandardOk({
    description: 'Bài đầy đủ trong phạm vi quản lý.',
    data: managedFeedPostExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Không tìm thấy bài được phép quản lý.')
  manage(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.queries.ownedDetail(param.id, user.userId);
  }

  @Post(':id/organization-review')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Owner duyệt/từ chối bài tổ chức theo đúng revision',
    description:
      'APPROVE kiểm tra lại tác giả/nhiệm kỳ/dịch vụ/chuyên môn; REJECT cần note >=5 ký tự, có thể ẩn nội bộ bài đã duyệt. Không thay status HIDDEN của Lambe. Revision cũ, quyết định trùng hoặc bài DELETED không được duyệt.',
  })
  @ApiStandardOk({
    description:
      'Bài với quyết định mới; public còn phụ thuộc trạng thái nền tảng.',
    data: {
      ...managedFeedPostExample,
      organizationReview: {
        status: 'APPROVED',
        reviewedAt: '2026-10-29T05:00:00.000Z',
        note: null,
      },
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Không tìm thấy bài trong tổ chức.')
  @ApiConflictResponse({
    description:
      'Revision đã thay đổi, quyết định trùng hoặc tác giả thuộc nhiệm kỳ cũ.',
  })
  @ApiForbiddenResponse({
    description:
      'Chỉ owner tổ chức được duyệt; tác giả hoặc chuyên môn hiện tại không hợp lệ.',
  })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: ReviewOrganizationFeedPostDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.decide(user.userId, param.id, dto, metadata);
  }
}
