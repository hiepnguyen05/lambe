import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { OrderOperationalAlertService } from '../application/operations/order-operational-alert.service';
import { ResolveOrderOperationalAlertDto } from '../dto/order-operational-alert.dto';
import { OrderCancellationService } from '../application/cancellation/order-cancellation.service';
import { OrderPaymentDisputeService } from '../application/payments/order-payment-dispute.service';

@ApiTags('Support Order Operational Alerts')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT)
@Controller('admin/orders/operational-alerts')
export class SupportOrderOperationalAlertsController {
  constructor(
    private readonly alerts: OrderOperationalAlertService,
    private readonly cancellations: OrderCancellationService,
    private readonly disputes: OrderPaymentDisputeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách cảnh báo đơn hàng cần xử lý' })
  list() {
    return this.alerts.list();
  }

  @Post(':id/acknowledge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đánh dấu đã nhận xử lý cảnh báo' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.alerts.acknowledge(id, actor, request);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đóng cảnh báo với ghi chú xử lý' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveOrderOperationalAlertDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.alerts.resolve(id, dto.resolutionNote, actor, request);
  }

  @Post(':id/cancel-order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hủy đơn bị treo trước khi dịch vụ bắt đầu' })
  cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveOrderOperationalAlertDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.cancellations.supportCancelStale(
      actor.accountId,
      id,
      dto.resolutionNote,
      request,
    );
  }

  @Post(':id/escalate-dispute')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Chuyển đơn đang thực hiện quá hạn sang tranh chấp',
  })
  escalateDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveOrderOperationalAlertDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.disputes.escalateStaleOrder(
      actor.accountId,
      id,
      dto.resolutionNote,
      request,
    );
  }
}
