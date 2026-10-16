import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrdersService } from '../application/orders.service';
import { OrderCancellationService } from '../application/cancellation/order-cancellation.service';
import {
  CompleteOrderDto,
  CancelOrderDto,
  OrderParamDto,
  OrderQueryDto,
  RejectOrderDto,
  RequestOrderCancellationDto,
} from '../dto/order.dto';

@ApiTags('Provider Orders')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/provider/orders')
export class ProviderOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cancellations: OrderCancellationService,
  ) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Thợ hủy đơn chưa khởi hành, giải phóng lịch và hoa hồng đang giữ',
  })
  @ApiStandardOk({
    description: 'Cancelled by the owning provider.',
    data: { status: 'CANCELLED' },
  })
  @ApiAuthenticationErrors()
  @ApiConflictError('Đơn đã khởi hành hoặc đang thực hiện.')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: CancelOrderDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.cancel(user.userId, params.id, dto, request, true);
  }

  @Post(':id/cancellation-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thợ yêu cầu hủy đơn sau khi khởi hành' })
  @ApiStandardOk({
    description: 'Khách được thông báo để xử lý.',
    data: { id: 'order-uuid' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  requestCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: RequestOrderCancellationDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.cancellations.request(user.userId, params.id, dto, request);
  }

  @Post(':id/contact-attempt')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @ApiOperation({ summary: 'Ghi nhận thao tác thử gọi khách sau khi đến nơi' })
  @ApiStandardOk({
    description:
      'Chỉ ghi nhận thao tác trong app, không xác nhận cuộc gọi đã kết nối.',
    data: { id: 'attempt-uuid' },
  })
  @ApiAuthenticationErrors()
  recordContactAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
  ) {
    return this.cancellations.recordContactAttempt(user.userId, params.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy các đơn được gửi tới nhà cung cấp hiện tại' })
  @ApiStandardOk({ description: 'Danh sách tối đa 50 đơn.', data: [] })
  @ApiAuthenticationErrors()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.orders.findProviderOrders(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một đơn được gửi tới nhà cung cấp' })
  @ApiStandardOk({
    description: 'Ẩn địa chỉ chính xác cho tới khi nhà cung cấp nhận đơn.',
    data: { id: 'order-uuid', status: 'PENDING_PROVIDER' },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn dịch vụ')
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
  ) {
    return this.orders.findProviderOrder(user.userId, params.id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nhận đơn và tạm giữ hoa hồng trong ví' })
  @ApiStandardOk({
    description: 'Nhận đơn thành công và mở địa chỉ đầy đủ.',
    message: 'Đã nhận đơn dịch vụ.',
    data: { id: 'order-uuid', status: 'ACCEPTED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Đơn đã được xử lý, hết hạn hoặc nhà cung cấp đang bận.')
  @ApiNotFoundError('Đơn dịch vụ')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.accept(user.userId, params.id, request);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối yêu cầu đặt dịch vụ' })
  @ApiStandardOk({
    description: 'Từ chối đơn thành công.',
    message: 'Đã từ chối đơn dịch vụ.',
    data: { id: 'order-uuid', status: 'REJECTED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Đơn không còn chờ phản hồi.')
  @ApiNotFoundError('Đơn dịch vụ')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: RejectOrderDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.reject(user.userId, params.id, dto.reason, request);
  }

  @Post(':id/en-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Báo đang di chuyển tới địa chỉ khách hàng' })
  @ApiStandardOk({
    description: 'Chuyển ACCEPTED sang EN_ROUTE.',
    data: { id: 'order-uuid', status: 'EN_ROUTE' },
  })
  @ApiAuthenticationErrors()
  @ApiConflictError('Đơn không ở trạng thái đã nhận.')
  markEnRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.markEnRoute(user.userId, params.id, request);
  }

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Báo đã đến địa chỉ khách hàng' })
  @ApiStandardOk({
    description: 'Chuyển EN_ROUTE sang ARRIVED.',
    data: { id: 'order-uuid', status: 'ARRIVED' },
  })
  @ApiAuthenticationErrors()
  @ApiConflictError('Đơn không ở trạng thái đang di chuyển.')
  markArrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.markArrived(user.userId, params.id, request);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bắt đầu thực hiện dịch vụ' })
  @ApiStandardOk({
    description: 'Chuyển ARRIVED sang IN_PROGRESS.',
    data: { id: 'order-uuid', status: 'IN_PROGRESS' },
  })
  @ApiAuthenticationErrors()
  @ApiConflictError('Đơn không ở trạng thái đã đến nơi.')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.start(user.userId, params.id, request);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận đã thu tiền mặt và hoàn thành đơn' })
  @ApiStandardOk({
    description: 'Hoàn thành đơn và trừ hoa hồng khỏi ví thợ.',
    message: 'Đơn đã hoàn thành và hoa hồng đã được trừ.',
    data: { id: 'order-uuid', status: 'COMPLETED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Đơn chưa ở trạng thái đang thực hiện.')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() _dto: CompleteOrderDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.complete(user.userId, params.id, request);
  }
}
