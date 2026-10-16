import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { OrderCancellationService } from '../application/cancellation/order-cancellation.service';
import { OrderEvidenceService } from '../application/evidence/order-evidence.service';
import { DecideOrderCancellationDto, OrderParamDto } from '../dto/order.dto';
import { OrderEvidenceIdParamDto } from '../dto/order-evidence.dto';

@ApiTags('Support Order Cancellations')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT, InternalRole.MODERATOR)
@Controller('admin/orders/cancellation-requests')
export class SupportOrderCancellationsController {
  constructor(
    private readonly cancellations: OrderCancellationService,
    private readonly evidence: OrderEvidenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu hủy đang chờ hỗ trợ' })
  list() {
    return this.cancellations.supportQueue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết đơn và yêu cầu hủy' })
  detail(@Param() params: OrderParamDto) {
    return this.cancellations.supportDetail(params.id);
  }

  @Get(':id/evidence/:evidenceId')
  @ApiOperation({ summary: 'Xem ảnh bằng chứng của yêu cầu hủy' })
  evidenceUrl(@Param() params: OrderEvidenceIdParamDto) {
    return this.evidence.getInternalDownload(params.id, params.evidenceId);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Hỗ trợ quyết định yêu cầu hủy theo mã đơn' })
  decide(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderParamDto,
    @Body() dto: DecideOrderCancellationDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.cancellations.supportDecide(
      account.accountId,
      params.id,
      dto,
      request,
    );
  }
}
