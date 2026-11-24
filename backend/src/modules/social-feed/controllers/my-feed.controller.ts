import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiStandardCreated,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { FeedPostsService } from '../application/feed-posts.service';
import { FeedQueryService } from '../application/feed-query.service';
import { FeedSocialService } from '../application/feed-social.service';
import {
  MAX_FEED_FILES,
  MAX_FEED_IMAGE_BYTES,
  MAX_FEED_VIDEO_BYTES,
} from '../application/feed-media';
import { FeedAccessService } from '../application/organization/feed-access.service';
import { FeedReviewService } from '../application/feed-review.service';
import { FeedOperationsService } from '../application/feed-operations.service';
import { AppealFeedDto } from '../dto/feed-moderation.dto';
import {
  CreateFeedCommentDto,
  CreateFeedPostDto,
  FeedIdParamDto,
  FeedListQueryDto,
  ReportFeedPostDto,
  UpdateFeedPostDto,
  ManagedFeedQueryDto,
} from '../dto/feed.dto';
import { managedFeedPostExample, publicFeedPostExample } from './feed.examples';

@ApiTags('Beauty Feed')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/feed')
export class MyFeedController {
  constructor(
    private readonly posts: FeedPostsService,
    private readonly queries: FeedQueryService,
    private readonly social: FeedSocialService,
    private readonly access: FeedAccessService,
    private readonly reviews: FeedReviewService,
    private readonly operations: FeedOperationsService,
  ) {}

  @Get('notices') notices(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.notices(user.userId);
  }
  @Patch('notices/:id/read') readNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.operations.readNotice(user.userId, param.id);
  }
  @Post('comments/:id/reports')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  reportComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: ReportFeedPostDto,
  ) {
    return this.operations.reportComment(user.userId, param.id, dto);
  }

  @Post('posts/:id/appeal')
  @Throttle({ medium: { limit: 6, ttl: 60000 } })
  appeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: AppealFeedDto,
  ) {
    return this.reviews.appeal(user.userId, param.id, dto);
  }

  @Get('publishing-context')
  @ApiOperation({
    summary: 'Lấy đúng tổ chức và dịch vụ người hiện tại được phép gắn vào bài',
  })
  publishingContext(@CurrentUser() user: AuthenticatedUser) {
    return this.access.publishingContext(user.userId);
  }

  @Post('posts')
  @Throttle({ medium: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FEED_FILES, {
      limits: { fileSize: MAX_FEED_IMAGE_BYTES, files: MAX_FEED_FILES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'caption',
        'providerServiceIds',
        'includesCustomer',
        'hasCustomerConsent',
        'files',
      ],
      properties: {
        caption: { type: 'string' },
        memberId: {
          type: 'string',
          format: 'uuid',
          description:
            'Membership của chính người đăng để chọn tổ chức; tùy chọn.',
        },
        providerServiceIds: { type: 'string', example: '["uuid"]' },
        includesCustomer: { type: 'boolean' },
        hasCustomerConsent: { type: 'boolean' },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Đối tác đăng 1-6 ảnh, gắn dịch vụ đang hoạt động',
    description:
      'Worker ACTIVE chỉ gắn dịch vụ được cấp và đủ chuyên môn; bài chờ owner duyệt. Owner đăng bài tổ chức được duyệt nội bộ tự động. Không yêu cầu online hoặc ví đủ số dư để đăng. Backend tự ghi snapshot tác giả. Upload thất bại hoặc bị thu hồi quyền trong lúc upload sẽ dọn media chưa lưu.',
  })
  @ApiStandardCreated({
    description:
      'Bài trong phạm vi quản lý; worker có organizationReview.status=PENDING.',
    data: managedFeedPostExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Khóa 8-128 ký tự để gửi lại an toàn khi mất kết nối.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeedPostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentRequestMetadata() metadata: RequestMetadata,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.posts.create(user.userId, dto, files, metadata, idempotencyKey);
  }

  @Post('posts/video')
  @Throttle({ medium: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FEED_VIDEO_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Khóa 8-128 ký tự để gửi lại an toàn khi mất kết nối.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'caption',
        'providerServiceIds',
        'includesCustomer',
        'hasCustomerConsent',
        'file',
      ],
      properties: {
        caption: { type: 'string' },
        memberId: { type: 'string', format: 'uuid' },
        providerServiceIds: { type: 'string', example: '["uuid"]' },
        includesCustomer: { type: 'boolean' },
        hasCustomerConsent: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Đối tác đăng một MP4 tối đa 30 MB và 60 giây',
  })
  @ApiStandardCreated({
    description: 'Bài video trong phạm vi quản lý.',
    data: managedFeedPostExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  createVideo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeedPostDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentRequestMetadata() metadata: RequestMetadata,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.posts.create(
      user.userId,
      dto,
      file ? [file] : [],
      metadata,
      idempotencyKey,
    );
  }

  @Patch('posts/:id')
  @ApiOperation({
    summary: 'Sửa chú thích/dịch vụ; bài do worker đăng phải duyệt lại',
    description:
      'Worker chỉ sửa bài của đúng nhiệm kỳ hiện tại. Owner sửa trong tổ chức, không đổi tác giả. Tăng revisionNumber; gửi revisionNumber hiện tại để chống ghi đè. Mọi sửa bài worker quay về PENDING kể cả owner sửa; không mở bài HIDDEN bởi nền tảng.',
  })
  @ApiStandardOk({
    description: 'Bài sau khi tăng revision, worker phải duyệt lại.',
    data: managedFeedPostExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Không tìm thấy bài được phép sửa.')
  @ApiConflictResponse({ description: 'Bài đã có phiên bản mới.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: UpdateFeedPostDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.posts.update(user.userId, param.id, dto, metadata);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Đối tác xóa mềm bài đăng của mình' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.posts.remove(user.userId, param.id, metadata);
  }

  @Get('following')
  @ApiOperation({ summary: 'Feed từ các đối tác đang theo dõi' })
  following(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedListQueryDto,
  ) {
    return this.queries.list(query, user.userId, 'following');
  }

  @Get('posts')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Feed công khai với trạng thái thích/lưu/theo dõi của tài khoản hiện tại',
  })
  @ApiStandardOk({
    description:
      'Cùng cổng hiển thị public và cursor; viewer được đọc theo user token, không cần GET từng bài.',
    data: { data: [publicFeedPostExample], nextCursor: null },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedListQueryDto,
  ) {
    return this.queries.list(query, user.userId);
  }

  @Get('saved')
  @ApiOperation({ summary: 'Các bài đã lưu' })
  saved(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedListQueryDto,
  ) {
    return this.queries.list(query, user.userId, 'saved');
  }

  @Get('mine')
  @ApiOperation({
    summary:
      'Bài quản lý: owner xem tổ chức, worker chỉ bài của nhiệm kỳ hiện tại',
    description:
      'Có organizationReviewStatus/authorMemberId để lọc hàng chờ. Kết hợp ownership với cursor, không tiết lộ bài người khác. Bao gồm bài pending/rejected/hidden, không bao gồm deleted.',
  })
  @ApiStandardOk({
    description:
      'Trang bài quản lý, bao gồm pending/rejected/hidden; vẫn giữ envelope data.data và data.nextCursor.',
    data: { data: [managedFeedPostExample], nextCursor: null },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ManagedFeedQueryDto,
  ) {
    return this.queries.list(query, user.userId, 'mine');
  }

  @Get('posts/:id')
  @ApiOperation({
    summary: 'Chi tiết bài công khai kèm trạng thái thích/lưu/theo dõi của tôi',
  })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.queries.detail(param.id, user.userId);
  }

  @Put('posts/:id/like')
  @HttpCode(200)
  like(@CurrentUser() user: AuthenticatedUser, @Param() param: FeedIdParamDto) {
    return this.social.like(user.userId, param.id);
  }

  @Delete('posts/:id/like')
  unlike(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.social.unlike(user.userId, param.id);
  }

  @Put('posts/:id/save')
  @HttpCode(200)
  save(@CurrentUser() user: AuthenticatedUser, @Param() param: FeedIdParamDto) {
    return this.social.save(user.userId, param.id);
  }

  @Delete('posts/:id/save')
  unsave(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.social.unsave(user.userId, param.id);
  }

  @Put('providers/:id/follow')
  @HttpCode(200)
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.social.follow(user.userId, param.id);
  }

  @Delete('providers/:id/follow')
  unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
  ) {
    return this.social.unfollow(user.userId, param.id);
  }

  @Post('posts/:id/comments')
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: CreateFeedCommentDto,
  ) {
    return this.social.comment(user.userId, param.id, dto);
  }

  @Delete('posts/:id/comments/:commentId')
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.social.deleteComment(user.userId, postId, commentId);
  }

  @Post('posts/:id/reports')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Báo cáo bài vi phạm để bộ phận kiểm duyệt xem xét',
  })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: FeedIdParamDto,
    @Body() dto: ReportFeedPostDto,
  ) {
    return this.social.report(user.userId, param.id, dto);
  }
}
