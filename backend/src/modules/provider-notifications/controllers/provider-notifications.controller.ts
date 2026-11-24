import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { streamNotifications } from '../../../common/http/stream-notifications';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderParamDto } from '../../orders/dto/order.dto';
import { OrderNotificationStreamQueryDto } from '../../orders/dto/order-notification-query.dto';
import { ProviderNotificationsService } from '../application/provider-notifications.service';
import { ProviderNotificationQueryDto } from '../dto/provider-notification-query.dto';

const noticeExample = {
  id: '14741a17-16a8-4742-ac20-c0792c3a6d22',
  providerId: 'b476f4b1-1781-4006-a8ca-b5fd06877736',
  event: 'WALLET_LOW_BALANCE',
  memberId: null,
  membershipVersion: null,
  readAt: null,
  resolvedAt: null,
  createdAt: '2026-10-30T05:00:00.000Z',
  recipientRole: 'PROVIDER_OWNER',
  entityType: 'PROVIDER_NOTIFICATION',
  deepLink: '/provider/wallet',
};

@ApiTags('Provider Operational Notifications')
@ApiBearerAuth('user-token')
@ApiAuthenticationErrors()
@ApiForbiddenResponse({
  description: 'Chỉ chủ hồ sơ đối tác hiện tại được truy cập.',
})
@UseGuards(JwtAuthGuard)
@Controller('me/provider/notifications')
export class ProviderNotificationsController {
  constructor(
    private readonly notifications: ProviderNotificationsService,
    private readonly cache: RedisCacheService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Owner xem thông báo vận hành, không trộn với thông báo nhận đơn của worker',
    description:
      'Số dư khả dụng thấp, member khóa/nghỉ/tài khoản hạn chế, đối tác tạm ngừng. Ownership lấy từ provider profile, không nhận providerId/userId từ client. resolvedAt khác null nghĩa cảnh báo đã được xử lý, không phải đã đọc.',
  })
  @ApiStandardOk({
    description:
      'Danh sách theo createdAt/id giảm dần, unreadCount toàn phạm vi.',
    data: [noticeExample],
    meta: { nextCursor: null, unreadCount: 1 },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiForbiddenResponse({ description: 'Không phải owner hồ sơ đối tác.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProviderNotificationQueryDto,
  ) {
    return this.notifications.list(user.userId, query);
  }

  @Get('events')
  @ApiOperation({
    summary: 'SSE thông báo vận hành mới của owner',
    description:
      'event=notification, id là UUID thông báo. Thứ tự phát riêng từng owner được gán sau commit, không phụ thuộc createdAt của transaction. after dùng ID đã nhận từ SSE, không dùng cursor chưa được phát. Redis chỉ wakeup, PostgreSQL giữ dữ liệu. Fallback polling 10s, đóng sau 30s để xác thực lại; client reconnect và dedupe. Stream không phát lại thay đổi readAt/resolvedAt của thông báo cũ; tải lại REST khi quay lại màn hình hoặc sau nạp tiền.',
  })
  @ApiProduces('text/event-stream')
  events(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderNotificationStreamQueryDto,
    @Res() response: Response,
  ) {
    return streamNotifications(
      response,
      query.after,
      (after) => this.notifications.changesSince(user.userId, after),
      (refresh) => this.cache.subscribeOrderNotifications(user.userId, refresh),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Owner đọc chi tiết thông báo rồi mở đúng wallet/member/account',
  })
  @ApiStandardOk({
    description: 'Không có tên, điện thoại, địa chỉ khách hoặc bằng chứng KYC.',
    data: noticeExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Thông báo không thuộc owner hiện tại')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param() param: OrderParamDto,
  ) {
    return this.notifications.detail(user.userId, param.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc, gọi lại không tạo hiệu ứng phụ' })
  @ApiStandardOk({
    description: 'Thông báo đã đọc; không tự xử lý sự cố hoặc thay số dư ví.',
    data: noticeExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Thông báo không thuộc owner hiện tại')
  read(@CurrentUser() user: AuthenticatedUser, @Param() param: OrderParamDto) {
    return this.notifications.markRead(user.userId, param.id);
  }
}
