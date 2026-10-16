import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderNotificationsService } from '../application/notifications/order-notifications.service';
import { OrderParamDto } from '../dto/order.dto';

@ApiTags('Order Notifications')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/notifications')
export class OrderNotificationsController {
  constructor(private readonly notifications: OrderNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Xem 50 thông báo đơn hàng gần nhất' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc thông báo của mình' })
  read(@CurrentUser() user: AuthenticatedUser, @Param() params: OrderParamDto) {
    return this.notifications.markRead(user.userId, params.id);
  }
}
