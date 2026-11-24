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
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { streamNotifications } from '../../../common/http/stream-notifications';
import { RedisCacheService } from '../../../infrastructure/cache/redis-cache.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderNotificationsService } from '../application/notifications/order-notifications.service';
import { OrderParamDto } from '../dto/order.dto';
import {
  OrderNotificationQueryDto,
  OrderNotificationStreamQueryDto,
} from '../dto/order-notification-query.dto';

@ApiTags('Order Notifications')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/notifications')
export class OrderNotificationsController {
  constructor(
    private readonly notifications: OrderNotificationsService,
    private readonly cache: RedisCacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Xem thông báo đơn hàng, hỗ trợ phân trang' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderNotificationQueryDto,
  ) {
    return this.notifications.list(user.userId, query);
  }

  @Get('events')
  @ApiOperation({
    summary: 'Luồng SSE thông báo đơn hàng của tài khoản hiện tại',
  })
  @ApiProduces('text/event-stream')
  async events(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderNotificationStreamQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    return streamNotifications(
      response,
      query.after,
      (after) => this.notifications.changesSince(user.userId, after),
      (refresh) => this.cache.subscribeOrderNotifications(user.userId, refresh),
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc thông báo của mình' })
  read(@CurrentUser() user: AuthenticatedUser, @Param() params: OrderParamDto) {
    return this.notifications.markRead(user.userId, params.id);
  }
}
