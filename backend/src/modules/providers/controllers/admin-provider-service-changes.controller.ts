import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InternalRole } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { ProviderServiceChangesService } from '../application/services/provider-service-changes.service';
import { ProviderServiceChangeDocumentsService } from '../application/services/provider-service-change-documents.service';
import { ProviderServiceChangeReviewService } from '../application/services/provider-service-change-review.service';
import {
  ApproveProviderServiceChangeDto,
  ProviderServiceChangeDecisionDto,
  ProviderServiceChangeQueryDto,
} from '../dto/provider-service-change.dto';

@ApiTags('Admin Provider Service Changes')
@ApiBearerAuth('internal-token')
@Controller('admin/provider-service-change-requests')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(
  InternalRole.ADMIN,
  InternalRole.MODERATOR,
  InternalRole.SERVICE_REVIEWER,
)
export class AdminProviderServiceChangesController {
  constructor(
    private readonly changes: ProviderServiceChangesService,
    private readonly review: ProviderServiceChangeReviewService,
    private readonly documents: ProviderServiceChangeDocumentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Hàng chờ duyệt thay đổi dịch vụ của đối tác' })
  list(@Query() query: ProviderServiceChangeQueryDto) {
    return this.changes.listInternal(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề xuất cho kiểm duyệt' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.changes.findInternal(id);
  }

  @Get(':id/documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'URL tạm thời xem chứng chỉ/portfolio của đề xuất' })
  accessDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.documents.access(
      id,
      documentId,
      request,
      undefined,
      actor.accountId,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Duyệt giá/dịch vụ; tạo dịch vụ chuẩn mới cần quyền Admin',
  })
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ApproveProviderServiceChangeDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.approve(id, dto, actor.accountId, actor.roles, request);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đối tác bổ sung thông tin dịch vụ' })
  requestChanges(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProviderServiceChangeDecisionDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.requestChanges(
      id,
      dto,
      actor.accountId,
      actor.roles,
      request,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối đề xuất thay đổi dịch vụ' })
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProviderServiceChangeDecisionDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.reject(id, dto, actor.accountId, actor.roles, request);
  }
}
