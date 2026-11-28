import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole, ServiceOrderStatus } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  ApiConflictError,
  ApiInternalAuthorizationErrors,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminOrderQueryService } from '../application/operations/admin-order-query.service';
import { OrderPaymentDisputeService } from '../application/payments/order-payment-dispute.service';
import {
  CloseUnpaidPaymentDisputeDto,
  DecidePaymentDisputeDto,
  OrderParamDto,
} from '../dto/order.dto';
import { AdminOrderQueryDto } from '../dto/admin-order-query.dto';

@ApiTags('Support Payment Disputes')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT, InternalRole.MODERATOR)
@ApiInternalAuthorizationErrors()
@Controller('admin/orders/payment-disputes')
export class SupportPaymentDisputesController {
  constructor(
    private readonly orders: AdminOrderQueryService,
    private readonly disputes: OrderPaymentDisputeService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách tranh chấp tiền mặt; lọc PAYMENT_DISPUTE hoặc DISPUTED',
  })
  @ApiStandardOk({
    description: 'Danh sách phân trang cho bộ phận hỗ trợ.',
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  })
  list(@Query() query: AdminOrderQueryDto) {
    if (
      query.status &&
      query.status !== ServiceOrderStatus.PAYMENT_DISPUTE &&
      query.status !== ServiceOrderStatus.DISPUTED
    )
      throw new BadRequestException('Chỉ lọc PAYMENT_DISPUTE hoặc DISPUTED.');
    return this.orders.list({
      ...query,
      status: query.status ?? ServiceOrderStatus.PAYMENT_DISPUTE,
    });
  }

  @Post(':id/decision')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Xác nhận đã thu tiền hoặc chưa thanh toán; chưa thanh toán vẫn giữ hoa hồng',
  })
  @ApiStandardOk({
    description:
      'Xác nhận chưa thanh toán giữ HOLD; đã thanh toán khấu trừ hoa hồng.',
    data: { id: 'order-uuid', status: 'DISPUTED' },
  })
  @ApiValidationError()
  @ApiConflictError('Đơn không còn tranh chấp hoặc khoản tạm giữ không hợp lệ.')
  decide(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderParamDto,
    @Body() dto: DecidePaymentDisputeDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.disputes.decide(account.accountId, params.id, dto, request);
  }

  @Post(':id/close-unpaid')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Đóng tranh chấp không thu được tiền, hủy đơn và hoàn lại khoản hoa hồng đang tạm giữ',
  })
  @ApiStandardOk({
    description: 'Đã đóng tranh chấp và hoàn lại khoản tạm giữ trong ví.',
    data: { id: 'order-uuid', status: 'CANCELLED' },
  })
  @ApiValidationError()
  @ApiConflictError('Đơn không còn tranh chấp hoặc khoản tạm giữ không hợp lệ.')
  closeUnpaid(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderParamDto,
    @Body() dto: CloseUnpaidPaymentDisputeDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.disputes.closeUnpaid(
      account.accountId,
      params.id,
      dto,
      request,
    );
  }
}
