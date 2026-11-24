import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiConflictError,
  ApiInternalAuthorizationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { MemberVerificationQueryService } from '../application/verification/member-verification-query.service';
import { MemberVerificationReviewService } from '../application/verification/member-verification-review.service';
import { MemberVerificationDocumentsService } from '../application/verification/member-verification-documents.service';
import {
  DecideProviderMemberVerificationDto,
  ProviderMemberIdentityAccessDto,
  ProviderMemberVerificationQueryDto,
  ReviewProviderMemberDocumentDto,
} from '../dto/provider-member-verification.dto';
import { MEMBER_KYC_REVIEWER_ROLES } from '../domain/member-review-access.policy';
import { memberVerificationExample } from './member-verification.examples';

@ApiTags('Admin Member Verification')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(...MEMBER_KYC_REVIEWER_ROLES)
@ApiInternalAuthorizationErrors()
@ApiValidationError()
@ApiNotFoundError('Membership hoặc hồ sơ xác minh')
@ApiConflictError('Hồ sơ, phiên bản hoặc điều kiện hoạt động đã thay đổi.')
@Controller('admin/provider-members')
export class AdminMemberVerificationController {
  constructor(
    private readonly query: MemberVerificationQueryService,
    private readonly review: MemberVerificationReviewService,
    private readonly documents: MemberVerificationDocumentsService,
  ) {}

  @Get('verifications')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Hàng chờ KYC của lần gia nhập hiện hành',
    description:
      'Lọc status/providerId và phân trang; không đưa hồ sơ của lần gia nhập cũ vào hàng chờ.',
  })
  @ApiStandardOk({
    description: 'Tóm tắt hồ sơ, không trả số CCCD hoặc URL giấy tờ.',
    data: [
      {
        id: memberVerificationExample.id,
        memberId: memberVerificationExample.memberId,
        status: 'PENDING_REVIEW',
        revisionNumber: 1,
        submittedAt: '2026-10-27T12:00:00Z',
        reviewedAt: null,
        member: {
          providerId: 'ff9beef6-2bad-49bd-a4e0-9d46d67e0f4c',
          displayName: 'Nguyễn Văn An',
          status: 'PENDING_VERIFICATION',
          membershipVersion: 1,
        },
      },
    ],
  })
  list(
    @Query() query: ProviderMemberVerificationQueryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.query.list(query, account);
  }

  @Get(':id/verification')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Reviewer xem thông tin KYC, số CCCD che và metadata tài liệu',
  })
  @ApiStandardOk({
    description: 'Ghi audit khi xem hồ sơ; không trả hash/ciphertext.',
    data: memberVerificationExample,
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.query.findOne(id, account, metadata);
  }

  @Post(':id/verification/identity/access')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Reviewer giải mã CCCD khi cần đối chiếu, bắt buộc lý do và đúng hồ sơ',
  })
  @ApiStandardOk({
    description: 'CCCD chỉ trả ở endpoint đặc quyền này và luôn ghi audit.',
    data: { nationalIdNumber: '001095012345' },
  })
  identity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderMemberIdentityAccessDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.accessIdentity(
      id,
      dto.verificationId,
      dto.reason,
      account,
      metadata,
    );
  }

  @Get(':id/verification/documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @Throttle({ medium: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reviewer tạo URL tạm xem giấy tờ hiện hành, có audit',
  })
  @ApiStandardOk({
    description: 'Không cache URL ký.',
    data: { url: 'https://example.test/signed-private-url', fileFormat: 'png' },
  })
  access(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.documents.access(
      id,
      documentId,
      { internal: account },
      metadata,
    );
  }

  @Patch(':id/verification/documents/:documentId')
  @ApiOperation({
    summary:
      'Xét duyệt riêng từng giấy tờ/chứng chỉ theo verificationId và revisionNumber',
  })
  @ApiStandardOk({
    description:
      'VERIFIED / NEEDS_CHANGES / REJECTED. Hai trạng thái sau cần ghi chú.',
    data: { ...memberVerificationExample.documents[0], status: 'VERIFIED' },
  })
  reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ReviewProviderMemberDocumentDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.reviewDocument(id, documentId, dto, account, metadata);
  }

  @Post(':id/verification/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Duyệt KYC và kích hoạt member khi toàn bộ bằng chứng hợp lệ',
    description:
      'Moderator/KYC reviewer được duyệt trực tiếp. Backend kiểm tra lại tuổi, danh tính, chứng chỉ, portfolio và catalog; chưa cấp lịch/dịch vụ nhận đơn trong P5A.',
  })
  @ApiStandardOk({
    description:
      'Verification APPROVED, member ACTIVE và canProvideServices=true.',
    data: {
      verification: {
        ...memberVerificationExample,
        status: 'APPROVED',
        revisionNumber: 1,
      },
      member: {
        id: memberVerificationExample.memberId,
        status: 'ACTIVE',
        canProvideServices: true,
      },
    },
  })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideProviderMemberVerificationDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.decide(id, 'approve', dto, account, metadata);
  }

  @Post(':id/verification/request-changes')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Yêu cầu bổ sung hồ sơ, giữ nguyên tài liệu đã xác minh',
  })
  @ApiStandardOk({
    description: 'Mở sửa phần cần bổ sung; giấy tờ VERIFIED vẫn khóa.',
    data: {
      verification: { ...memberVerificationExample, status: 'NEEDS_CHANGES' },
      member: {
        id: memberVerificationExample.memberId,
        status: 'PENDING_VERIFICATION',
      },
    },
  })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideProviderMemberVerificationDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.decide(id, 'request-changes', dto, account, metadata);
  }

  @Post(':id/verification/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Từ chối KYC, không kích hoạt và giữ lịch sử' })
  @ApiStandardOk({
    description:
      'Hồ sơ REJECTED; có thể rời và xin lời mời mới nếu được tổ chức chấp thuận.',
    data: {
      verification: { ...memberVerificationExample, status: 'REJECTED' },
      member: {
        id: memberVerificationExample.memberId,
        status: 'PENDING_VERIFICATION',
      },
    },
  })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideProviderMemberVerificationDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.review.decide(id, 'reject', dto, account, metadata);
  }
}
