import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  ApiAuthenticationErrors,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrdersService } from '../application/orders.service';
import { OrderCancellationService } from '../application/cancellation/order-cancellation.service';
import { OrderReviewService } from '../application/reviews/order-review.service';
import {
  CancelOrderDto,
  CreateOrderReviewDto,
  DecideOrderCancellationDto,
  CreateOrderDto,
  OrderParamDto,
  OrderQueryDto,
  OrderQuoteDto,
} from '../dto/order.dto';

const quoteExample = {
  bookingType: 'SCHEDULED',
  scheduledAt: '2026-10-14T07:00:00.000Z',
  expectedStartAt: '2026-10-14T07:00:00.000Z',
  expectedEndAt: '2026-10-14T08:00:00.000Z',
  provider: { id: 'provider-uuid', displayName: 'Nguyen Van A' },
  providerServiceId: 'provider-service-uuid',
  serviceName: 'Cắt tóc nam',
  servicePriceAmount: 150000,
  travelFeeAmount: 0,
  totalAmount: 150000,
  currencyCode: 'VND',
  durationMinutes: 60,
  distanceKm: 4.2,
  available: false,
  reason: 'PROVIDER_TIME_CONFLICT',
  suggestedSlots: [
    {
      startAt: '2026-10-14T08:30:00.000Z',
      endAt: '2026-10-14T09:30:00.000Z',
      availability: 'AVAILABLE',
      requiresProviderConfirmation: true,
    },
  ],
  estimateSource: 'CONSERVATIVE_DISTANCE',
  requiresProviderConfirmation: true,
};

@ApiTags('Customer Orders')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class CustomerOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cancellations: OrderCancellationService,
    private readonly reviews: OrderReviewService,
  ) {}

  @Post('orders/quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kiểm tra điều kiện và lấy báo giá đặt dịch vụ' })
  @ApiStandardOk({
    description:
      'Báo giá tức thời, chưa giữ lịch. Khi available=false, gợi ý trong suggestedSlots (khi available=true, mảng rỗng).',
    data: quoteExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Địa chỉ hoặc dịch vụ nhà cung cấp')
  quote(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderQuoteDto) {
    return this.orders.quote(user.userId, dto);
  }

  @Post('orders')
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description:
      '8-128 letters, digits, underscore or hyphen. Reuse only when retrying the same request.',
  })
  @ApiOperation({ summary: 'Tạo yêu cầu đặt ngay hoặc đặt lịch trước' })
  @ApiStandardCreated({
    description: 'Đã tạo đơn ở trạng thái chờ nhà cung cấp phản hồi.',
    message: 'Đã gửi yêu cầu đặt dịch vụ tới nhà cung cấp.',
    data: {
      id: 'order-uuid',
      status: 'PENDING_PROVIDER',
      bookingType: 'SCHEDULED',
      scheduledAt: quoteExample.scheduledAt,
      expectedStartAt: quoteExample.expectedStartAt,
      expectedEndAt: quoteExample.expectedEndAt,
      totalAmount: 150000,
      durationMinutes: 60,
      providerResponseDeadlineAt: '2026-10-12T07:30:00.000Z',
    },
  })
  @ApiConflictResponse({
    description:
      'Lịch đã bị giữ, thợ bận/ngoài bán kính, ví không đủ hoặc Idempotency-Key đã dùng với nội dung khác. Client phải tải lại báo giá.',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        suggestedSlots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startAt: { type: 'string', format: 'date-time' },
              endAt: { type: 'string', format: 'date-time' },
              availability: {
                type: 'string',
                enum: ['AVAILABLE', 'ESTIMATED'],
              },
              requiresProviderConfirmation: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Địa chỉ hoặc dịch vụ nhà cung cấp')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @CurrentRequestMetadata() request: RequestMetadata,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.orders.create(user.userId, dto, request, idempotencyKey);
  }

  @Get('me/orders')
  @ApiOperation({ summary: 'Lấy danh sách đơn của khách hàng hiện tại' })
  @ApiStandardOk({ description: 'Danh sách tối đa 50 đơn gần nhất.', data: [] })
  @ApiAuthenticationErrors()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.orders.findMine(user.userId, query);
  }

  @Get('me/orders/:id')
  @ApiOperation({ summary: 'Xem chi tiết đơn của khách hàng hiện tại' })
  @ApiStandardOk({
    description: 'Chi tiết đơn và lịch sử trạng thái.',
    data: { id: 'order-uuid', status: 'PENDING_PROVIDER' },
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Đơn dịch vụ')
  findMineById(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
  ) {
    return this.orders.findMineById(user.userId, params.id);
  }

  @Post('me/orders/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy đơn đang chờ hoặc đã được nhận' })
  @ApiStandardOk({
    description: 'Hủy đơn và hoàn lại khoản hoa hồng đang giữ cho ví thợ.',
    message: 'Đã hủy đơn dịch vụ.',
    data: { id: 'order-uuid', status: 'CANCELLED' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Đơn dịch vụ')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: CancelOrderDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.cancel(user.userId, params.id, dto, request);
  }

  @Post('me/orders/:id/cancellation/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Khách đồng ý hủy hoặc chuyển yêu cầu sang hỗ trợ' })
  @ApiStandardOk({
    description: 'Đã xử lý yêu cầu hủy.',
    data: { id: 'order-uuid' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  decideCancellation(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: DecideOrderCancellationDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.cancellations.customerDecide(
      user.userId,
      params.id,
      dto,
      request,
    );
  }

  @Post('me/orders/:id/review')
  @ApiOperation({ summary: 'Đánh giá một đơn đã hoàn thành' })
  @ApiStandardCreated({
    description: 'Đã ghi nhận đánh giá.',
    data: { id: 'review-uuid', rating: 5 },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: CreateOrderReviewDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.reviews.create(user.userId, params.id, dto, request);
  }
}
