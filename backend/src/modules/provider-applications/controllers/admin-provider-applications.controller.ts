import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InternalRole, ProviderApplicationSection } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { ProviderApplicationReviewService } from '../application/review/provider-application-review.service';
import { ProviderApplicationDocumentsService } from '../application/documents/provider-application-documents.service';
import { ProviderApplicationsQueryService } from '../application/applications/provider-applications-query.service';
import { ProviderApplicationQueryDto } from '../dto/provider-application-query.dto';
import {
  assertProviderSectionReviewAllowed,
  canReviewProviderKyc,
  PROVIDER_APPLICATION_REVIEWER_ROLES,
} from '../domain/provider-review-permissions.policy';
import {
  ProviderApplicationDecisionDto,
  ReviewItemDto,
} from '../dto/review-provider-application.dto';

@ApiTags('Admin Provider Applications')
@ApiBearerAuth('internal-token')
@Controller('admin/provider-applications')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(
  ...PROVIDER_APPLICATION_REVIEWER_ROLES,
  InternalRole.SERVICE_REVIEWER,
  InternalRole.SUPPORT,
)
export class AdminProviderApplicationsController {
  constructor(
    private readonly queryService: ProviderApplicationsQueryService,
    private readonly review: ProviderApplicationReviewService,
    private readonly documents: ProviderApplicationDocumentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy hàng chờ đăng ký nhà cung cấp' })
  findAll(
    @Query() query: ProviderApplicationQueryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.queryService.findAllForInternal(
      query,
      canReviewProviderKyc(account.roles),
    );
  }

  @Get(':id/documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Tạo URL tạm thời để kiểm tra tài liệu KYC' })
  accessDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.documents.getInternalAccess(
      id,
      documentId,
      account.accountId,
      request,
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Xem toàn bộ hồ sơ đăng ký để xét duyệt' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    if (!canReviewProviderKyc(account.roles))
      return this.queryService.findOneForSupport(id);
    return this.queryService.findOneForInternal(id, account.accountId, request);
  }

  @Patch(':id/checks/:section')
  @InternalRoles(
    ...PROVIDER_APPLICATION_REVIEWER_ROLES,
    InternalRole.SERVICE_REVIEWER,
  )
  @ApiOperation({ summary: 'Xét duyệt một nhóm thông tin' })
  reviewCheck(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('section', new ParseEnumPipe(ProviderApplicationSection))
    section: ProviderApplicationSection,
    @Body() dto: ReviewItemDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    assertProviderSectionReviewAllowed(account.roles, section);
    return this.review.reviewCheck(
      id,
      section,
      dto,
      account.accountId,
      request,
    );
  }

  @Patch(':id/documents/:documentId/review')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @ApiOperation({ summary: 'Xét duyệt một tài liệu' })
  reviewDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @Body() dto: ReviewItemDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.reviewDocument(
      id,
      documentId,
      dto,
      account.accountId,
      request,
    );
  }

  @Patch(':id/services/:itemId/review')
  @InternalRoles(
    ...PROVIDER_APPLICATION_REVIEWER_ROLES,
    InternalRole.SERVICE_REVIEWER,
  )
  @ApiOperation({ summary: 'Xét duyệt dịch vụ và giá đề xuất' })
  reviewService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: ReviewItemDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.reviewService(
      id,
      itemId,
      dto,
      account.accountId,
      request,
    );
  }

  @Post(':id/request-changes')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trả hồ sơ để người đăng ký bổ sung' })
  requestChanges(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProviderApplicationDecisionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.requestChanges(id, dto, account.accountId, request);
  }

  @Post(':id/reject')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối hồ sơ đăng ký' })
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProviderApplicationDecisionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.reject(id, dto, account.accountId, request);
  }

  @Post(':id/approve')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt hồ sơ và tạo nhà cung cấp' })
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.approve(id, account.accountId, request);
  }
}
