import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedQueryService } from '../application/feed-query.service';
import {
  ApiStandardOk,
  ApiNotFoundError,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { publicFeedPostExample } from './feed.examples';
import {
  FeedCommentsQueryDto,
  FeedIdParamDto,
  FeedListQueryDto,
} from '../dto/feed.dto';

@ApiTags('Beauty Feed')
@Controller('feed/posts')
export class PublicFeedController {
  constructor(private readonly queries: FeedQueryService) {}

  @Get()
  @ApiOperation({
    summary:
      'Feed công khai, phân trang theo cursor; lọc theo đối tác hoặc dịch vụ',
  })
  @ApiStandardOk({
    description:
      'Chỉ bài PUBLISHED và đã qua cổng duyệt tổ chức (hoặc legacy/cá nhân). authorMember là snapshot công khai hoặc null. Cursor thuộc đúng phạm vi; limit 1–50.',
    data: { data: [publicFeedPostExample], nextCursor: null },
  })
  @ApiValidationError()
  list(@Query() query: FeedListQueryDto) {
    return this.queries.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết bài đăng công khai kèm dịch vụ có thể đặt',
  })
  @ApiStandardOk({
    description:
      'Không có lý do duyệt, reviewer, membershipVersion hay thông tin KYC. Bài pending/rejected/hidden/deleted trả 404.',
    data: publicFeedPostExample,
  })
  @ApiNotFoundError('Không tìm thấy bài công khai.')
  detail(@Param() param: FeedIdParamDto) {
    return this.queries.detail(param.id);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'Bình luận và tối đa 20 phản hồi đầu mỗi bình luận',
  })
  comments(
    @Param() param: FeedIdParamDto,
    @Query() query: FeedCommentsQueryDto,
  ) {
    return this.queries.comments(param.id, query.cursor, query.limit);
  }

  @Get(':id/comments/:commentId/replies')
  @ApiOperation({ summary: 'Phân trang phản hồi của một bình luận gốc' })
  replies(
    @Param('id', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query() query: FeedCommentsQueryDto,
  ) {
    return this.queries.replies(postId, commentId, query.cursor, query.limit);
  }
}
