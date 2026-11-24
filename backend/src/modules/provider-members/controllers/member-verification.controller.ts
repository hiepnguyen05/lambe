import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { MemberVerificationService } from '../application/verification/member-verification.service';
import { MemberVerificationDocumentsService } from '../application/verification/member-verification-documents.service';
import { MemberVerificationRenewalService } from '../application/verification/member-verification-renewal.service';
import {
  ProviderMemberDocumentQueryDto,
  ReopenProviderMemberVerificationDto,
  SaveProviderMemberVerificationDto,
} from '../dto/provider-member-verification.dto';
import { memberVerificationExample } from './member-verification.examples';
import { MEMBER_TERMS_TEXT } from '../domain/member-verification.constants';

@ApiTags('My Member Verification')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiNotFoundError('Membership hoặc hồ sơ xác minh')
@ApiConflictError(
  'Hồ sơ hoặc lần gia nhập đã thay đổi, đang khóa hoặc đã xử lý.',
)
@Controller('me/provider/memberships/:memberId/verification')
export class MemberVerificationController {
  constructor(
    private readonly verification: MemberVerificationService,
    private readonly documents: MemberVerificationDocumentsService,
    private readonly renewal: MemberVerificationRenewalService,
  ) {}

  @Get('options')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lấy điều khoản, loại giấy tờ và dịch vụ tổ chức để chuẩn bị KYC',
  })
  @ApiStandardOk({
    description:
      'Các ProviderService đang ACTIVE của tổ chức, kèm yêu cầu chuyên môn.',
    data: {
      termsVersion: 'member-2026-10-27',
      termsText: MEMBER_TERMS_TEXT,
      documentTypes: [
        'PORTRAIT',
        'ID_CARD_FRONT',
        'ID_CARD_BACK',
        'IDENTITY_SELFIE',
        'PROFESSIONAL_CERTIFICATE',
        'PORTFOLIO',
      ],
      maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
      services: [
        {
          id: 'f7792b77-ccf5-4ea4-a4c4-d72b37252bbd',
          service: {
            id: '83ee0216-2d52-4c81-b761-984a974dd8cc',
            name: 'Cắt tóc nam',
            requiresCertificate: true,
            minExperienceYears: 1,
            minPortfolioImages: 1,
          },
        },
      ],
    },
  })
  options(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.verification.options(user.userId, memberId);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Xem KYC của chính mình trong lần gia nhập hiện hành',
  })
  @ApiStandardOk({
    description:
      'data=null nếu chưa lưu. CCCD che số; không trả ciphertext/hash/publicId/URL giấy tờ.',
    data: memberVerificationExample,
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.verification.findMine(user.userId, memberId);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lưu thông tin KYC đầy đủ khi DRAFT hoặc NEEDS_CHANGES',
    description:
      'Đổi danh tính làm các tài liệu danh tính cần xét lại. Chưa kích hoạt worker.',
  })
  @ApiStandardOk({
    description: 'Hồ sơ cá nhân đã lưu với CCCD mã hóa.',
    data: memberVerificationExample,
  })
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SaveProviderMemberVerificationDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.verification.save(user.userId, memberId, dto, metadata);
  }

  @Post('submit')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Gửi KYC đủ thông tin và giấy tờ sang kiểm duyệt' })
  @ApiStandardOk({
    description: 'Tạo snapshot, tăng revisionNumber và khóa sửa khi chờ duyệt.',
    data: {
      ...memberVerificationExample,
      status: 'PENDING_REVIEW',
      revisionNumber: 1,
    },
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.verification.submit(user.userId, memberId, metadata);
  }

  @Post('reopen')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Mở lại KYC đã duyệt để cập nhật/gia hạn tài liệu',
    description:
      'Dừng quyền thực hiện dịch vụ tới khi duyệt lại; giữ đình chỉ nếu đang bị khóa. Yêu cầu tổ chức không còn nghĩa vụ đang mở trong P5A.',
  })
  @ApiStandardOk({
    description:
      'Chỉ các documentIds đã chọn được mở bổ sung; giữ các tài liệu khác.',
    data: { ...memberVerificationExample, status: 'NEEDS_CHANGES' },
  })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ReopenProviderMemberVerificationDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.renewal.reopen(user.userId, memberId, dto, metadata);
  }

  @Post('documents')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1, fields: 0 },
    }),
  )
  @ApiOperation({
    summary: 'Tải một ảnh giấy tờ/chứng chỉ lên kho riêng tư',
    description:
      'Metadata truyền qua query. JPEG/PNG/WEBP/GIF tối đa 5 MB; không nhận SVG. Thay ảnh bằng replacesDocumentId, giữ bản cũ trong lịch sử.',
  })
  @ApiStandardCreated({
    description: 'Metadata an toàn của ảnh mới; không trả URL.',
    data: memberVerificationExample.documents[0],
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Query() query: ProviderMemberDocumentQueryDto,
    @UploadedFile(createImageUploadPipe({ allowSvg: false }))
    file: Express.Multer.File,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.documents.upload(
      user.userId,
      memberId,
      query,
      file.buffer,
      metadata,
    );
  }

  @Delete('documents/:documentId')
  @ApiOperation({
    summary: 'Bỏ tài liệu khỏi bản nháp; giữ ảnh trong lịch sử riêng tư',
  })
  @ApiStandardOk({
    description: 'Đã bỏ tài liệu khỏi bản hiện hành.',
    data: null,
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.documents.remove(user.userId, memberId, documentId, metadata);
  }

  @Get('documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Xem ảnh giấy tờ của chính mình qua URL có hạn và audit',
  })
  @ApiStandardOk({
    description: 'URL ký tạm thời; không lưu vào analytics/cache.',
    data: { url: 'https://example.test/signed-private-url', fileFormat: 'png' },
  })
  access(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.documents.access(
      memberId,
      documentId,
      { userId: user.userId },
      metadata,
    );
  }
}
