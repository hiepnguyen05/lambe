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
import {
  ApiInternalAuthorizationErrors,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { OrderSafetyEvidenceService } from '../application/safety/order-safety-evidence.service';
import { OrderSafetyService } from '../application/safety/order-safety.service';
import {
  CloseOrderSafetyDto,
  OrderSafetyEvidenceParamDto,
  OrderSafetyParamDto,
} from '../dto/order-safety.dto';

@ApiTags('Support Order Safety')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT)
@ApiInternalAuthorizationErrors()
@Controller('admin/safety/incidents')
export class SupportOrderSafetyController {
  constructor(
    private readonly safety: OrderSafetyService,
    private readonly evidence: OrderSafetyEvidenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tối đa 50 sự cố an toàn đang mở' })
  @ApiStandardOk({
    description: 'Danh sách không chứa địa chỉ hoặc báo cáo chi tiết.',
    data: [],
  })
  queue() {
    return this.safety.queue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết sự cố; truy cập được ghi audit' })
  detail(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderSafetyParamDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.safety.detail(account.accountId, params.id, metadata);
  }

  @Get(':id/evidence/:evidenceId')
  @ApiOperation({
    summary: 'Lấy liên kết xem ảnh sự cố riêng tư; truy cập được ghi audit',
  })
  evidenceUrl(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderSafetyEvidenceParamDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.evidence.staffDownload(
      account.accountId,
      params.id,
      params.evidenceId,
      metadata,
    );
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đóng sự cố, hủy đơn, giải phóng lịch và khoản hoa hồng đang giữ',
  })
  @ApiStandardOk({
    description: 'Đã đóng hồ sơ sự cố.',
    data: { id: 'incident-uuid', status: 'CLOSED' },
  })
  close(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param() params: OrderSafetyParamDto,
    @Body() dto: CloseOrderSafetyDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.safety.close(account.accountId, params.id, dto, metadata);
  }
}
