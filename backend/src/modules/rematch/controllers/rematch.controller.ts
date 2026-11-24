import {
  Body,
  Controller,
  Get,
  Headers,
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
import { OrderParamDto } from '../../orders/dto/order.dto';
import { RematchService } from '../application/rematch.service';
import { RematchCandidatesQueryDto, RetryOrderDto } from '../dto/rematch.dto';

@ApiTags('Customer Orders')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@Controller('me/orders/:id')
export class RematchController {
  constructor(private readonly rematch: RematchService) {}

  @Get('rematch-candidates')
  @ApiOperation({ summary: 'Tìm thợ khác cho đơn bị từ chối hoặc hết hạn' })
  @ApiStandardOk({
    description:
      'Trả snapshot đơn gốc và danh sách thợ hiện đủ điều kiện; đã loại thợ từng thử.',
    data: {
      sourceOrderId: 'order-uuid',
      bookingGroupId: 'group-uuid',
      orderDraft: {
        serviceId: 'service-uuid',
        bookingType: 'SCHEDULED',
        scheduledAt: '2026-10-28T07:00:00.000Z',
        inlineAddress: {
          label: 'Nhà riêng',
          addressLine: '123 Đường A',
          latitude: 10.77,
          longitude: 106.7,
        },
        contactName: 'Nguyễn Văn A',
        contactPhone: '0912345678',
        customerNote: 'Gọi trước khi đến',
      },
      service: {
        id: 'service-uuid',
        name: 'Cắt tóc nam',
        category: { id: 'category-uuid', name: 'Tóc' },
      },
      candidates: [
        {
          id: 'provider-uuid',
          service: { id: 'provider-service-uuid', priceAmount: 120000 },
          distanceKm: 2.5,
        },
      ],
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Đơn dịch vụ của khách')
  @ApiConflictResponse({
    description: 'Đơn không còn được phép tìm thợ khác hoặc lịch hẹn đã qua.',
  })
  candidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Query() query: RematchCandidatesQueryDto,
  ) {
    return this.rematch.candidates(user.userId, params.id, query);
  }

  @Post('retry')
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOperation({ summary: 'Đặt lại với thợ đã chọn và báo giá mới' })
  @ApiStandardCreated({
    description:
      'Đã tạo lần thử mới trong cùng booking group, chờ thợ xác nhận.',
    data: {
      id: 'new-order-uuid',
      bookingGroupId: 'group-uuid',
      bookingAttempt: 2,
      status: 'PENDING_PROVIDER',
    },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Đơn dịch vụ của khách hoặc dịch vụ của thợ')
  @ApiConflictResponse({
    description:
      'Thợ đã thử, báo giá thay đổi, lịch bận hoặc đã có lần thử mới.',
  })
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OrderParamDto,
    @Body() dto: RetryOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.rematch.retry(
      user.userId,
      params.id,
      dto,
      request,
      idempotencyKey,
    );
  }
}
