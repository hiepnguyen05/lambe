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
import {
  documentAccessExample,
  providerApprovedProfileExample,
  providerApplicationExample,
  providerReviewCheckExample,
} from '../../../common/openapi/api-examples';
import {
  ApiInternalAuthorizationErrors,
  ApiNotFoundError,
  ApiRateLimitError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { ProviderApplicationReviewService } from '../application/review/provider-application-review.service';
import { ReviewProviderServiceSuggestionService } from '../application/services/review-provider-service-suggestion.service';
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
import {
  ApproveProviderServiceSuggestionDto,
  RejectProviderServiceSuggestionDto,
} from '../dto/provider-service-suggestion.dto';

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
    private readonly serviceSuggestions: ReviewProviderServiceSuggestionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy hàng chờ đăng ký nhà cung cấp' })
  @ApiStandardOk({
    description:
      'Danh sách hồ sơ đăng ký đối tác cho bộ phận kiểm duyệt/hỗ trợ.',
    data: [providerApplicationExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  @ApiInternalAuthorizationErrors()
  findAll(
    @Query() query: ProviderApplicationQueryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.queryService.findAllForInternal(
      query,
      canReviewProviderKyc(account.roles),
    );
  }

  @Get(':id/documents/access')
  @Header('Cache-Control', 'no-store')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Lấy thư viện ảnh tài liệu KYC để kiểm duyệt' })
  @ApiStandardOk({
    description:
      'Trả URL xem trước cho toàn bộ tài liệu trong hồ sơ bằng một yêu cầu có kiểm soát.',
    data: [
      {
        documentId: '983433c1-3eb9-46ee-8a7d-937709700a49',
        ...documentAccessExample,
      },
    ],
  })
  @ApiInternalAuthorizationErrors()
  @ApiRateLimitError()
  accessDocumentGallery(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.documents.getInternalPreviewGallery(
      id,
      account.accountId,
      request,
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
  @ApiStandardOk({
    description:
      'Tạo URL tạm thời cho tài liệu nhạy cảm. Chỉ reviewer có quyền KYC được dùng.',
    data: documentAccessExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiRateLimitError()
  @ApiNotFoundError('Tài liệu')
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
  @ApiStandardOk({
    description:
      'Chi tiết hồ sơ đăng ký đối tác. Với SUPPORT, dữ liệu nhạy cảm được giới hạn theo quyền.',
    data: providerApplicationExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description: 'Cập nhật trạng thái kiểm duyệt của một nhóm hồ sơ.',
    message: 'Đã cập nhật hạng mục xét duyệt.',
    data: providerReviewCheckExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description: 'Cập nhật trạng thái kiểm duyệt của tài liệu.',
    message: 'Đã xét duyệt tài liệu.',
    data: null,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Tài liệu')
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
  @ApiStandardOk({
    description: 'Cập nhật trạng thái kiểm duyệt dịch vụ/giá đề xuất.',
    message: 'Đã xét duyệt dịch vụ đăng ký.',
    data: null,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Dịch vụ trong hồ sơ')
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

  @Post(':id/review-all-eligible')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác minh tất cả mục đang chờ và đủ điều kiện' })
  @ApiStandardOk({
    description:
      'Xác minh tài liệu, dịch vụ hợp lệ và các hạng mục có thể hoàn tất; đề xuất dịch vụ vẫn phải được xử lý riêng.',
    data: {
      verifiedDocuments: 3,
      verifiedServices: 2,
      verifiedChecks: 4,
      skippedServices: [],
      pendingSuggestions: 0,
    },
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  reviewAllEligible(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.reviewAllEligible(id, account.accountId, request);
  }

  @Post(':id/service-suggestions/:suggestionId/approve')
  @InternalRoles(InternalRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt đề xuất và tạo dịch vụ trong hệ thống' })
  @ApiStandardOk({
    description:
      'Dịch vụ được tạo trong danh mục và dịch vụ đăng ký được xác minh trong cùng giao dịch.',
    data: { service: { id: 'uuid' }, applicationService: { id: 'uuid' } },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  approveSuggestion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('suggestionId', new ParseUUIDPipe({ version: '4' }))
    suggestionId: string,
    @Body() dto: ApproveProviderServiceSuggestionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.serviceSuggestions.approve(
      id,
      suggestionId,
      dto,
      account.accountId,
      request,
    );
  }

  @Post(':id/service-suggestions/:suggestionId/reject')
  @InternalRoles(InternalRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối đề xuất dịch vụ' })
  @ApiStandardOk({
    description:
      'Đề xuất bị loại khỏi hồ sơ; các dịch vụ hợp lệ khác vẫn có thể được phê duyệt.',
    data: { id: 'uuid', status: 'REJECTED' },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  rejectSuggestion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('suggestionId', new ParseUUIDPipe({ version: '4' }))
    suggestionId: string,
    @Body() dto: RejectProviderServiceSuggestionDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.serviceSuggestions.reject(
      id,
      suggestionId,
      dto,
      account.accountId,
      request,
    );
  }

  @Post(':id/request-changes')
  @InternalRoles(...PROVIDER_APPLICATION_REVIEWER_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trả hồ sơ để người đăng ký bổ sung' })
  @ApiStandardOk({
    description: 'Trả hồ sơ về trạng thái cần bổ sung.',
    message: 'Đã gửi yêu cầu bổ sung hồ sơ.',
    data: null,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description: 'Từ chối hồ sơ đăng ký đối tác.',
    message: 'Đã từ chối hồ sơ đăng ký.',
    data: null,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description:
      'Duyệt hồ sơ, cấp role PROVIDER, tạo provider profile, wallet và dịch vụ của nhà cung cấp.',
    message: 'Đã duyệt hồ sơ và tạo tài khoản nhà cung cấp.',
    data: providerApprovedProfileExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.review.approve(id, account.accountId, request);
  }
}
