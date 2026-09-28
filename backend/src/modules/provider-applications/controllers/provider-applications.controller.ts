import {
  Body,
  Controller,
  Delete,
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
import { ProviderDocumentType } from '@prisma/client';
import 'multer';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ProviderApplicationDocumentsService } from '../application/documents/provider-application-documents.service';
import { ProviderApplicationsQueryService } from '../application/applications/provider-applications-query.service';
import { ProviderApplicationsService } from '../application/applications/provider-applications.service';
import { CURRENT_PROVIDER_TERMS_VERSION } from '../constants/provider-terms.constants';
import { AcceptProviderTermsDto } from '../dto/accept-provider-terms.dto';
import { CreateProviderApplicationDto } from '../dto/create-provider-application.dto';
import {
  AddProviderApplicationServiceDto,
  UpdateProviderApplicationServiceDto,
} from '../dto/provider-application-service.dto';
import { ProviderDocumentQueryDto } from '../dto/provider-document-query.dto';
import { UpdateProviderApplicationDto } from '../dto/update-provider-application.dto';
import { VerifyProviderEmailDto } from '../dto/verify-provider-email.dto';
import { ProviderEmailVerificationService } from '../application/email-verification/provider-email-verification.service';
import { ProviderApplicationServicesService } from '../application/services/provider-application-services.service';

@ApiTags('Provider Applications')
@ApiBearerAuth('user-token')
@Controller('provider-applications')
@UseGuards(JwtAuthGuard)
export class ProviderApplicationsController {
  constructor(
    private readonly queryService: ProviderApplicationsQueryService,
    private readonly applications: ProviderApplicationsService,
    private readonly documents: ProviderApplicationDocumentsService,
    private readonly emailVerification: ProviderEmailVerificationService,
    private readonly applicationServices: ProviderApplicationServicesService,
  ) {}

  @Get('terms/current')
  @ApiOperation({ summary: 'Lấy phiên bản điều khoản nhà cung cấp hiện hành' })
  getCurrentTerms() {
    return { success: true, data: { version: CURRENT_PROVIDER_TERMS_VERSION } };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy các hồ sơ đăng ký của người dùng hiện tại' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.queryService.findMine(user.userId);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ đăng ký của chính mình' })
  findMineById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queryService.findMineById(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo bản nháp đăng ký nhà cung cấp' })
  create(
    @Body() dto: CreateProviderApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ đăng ký' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProviderApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.update(id, user.userId, dto);
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Thêm dịch vụ và giá đề xuất vào hồ sơ' })
  addService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddProviderApplicationServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationServices.add(id, user.userId, dto);
  }

  @Patch(':id/services/:itemId')
  @ApiOperation({ summary: 'Cập nhật dịch vụ đã đăng ký' })
  updateService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateProviderApplicationServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationServices.update(id, itemId, user.userId, dto);
  }

  @Delete(':id/services/:itemId')
  @ApiOperation({ summary: 'Xóa dịch vụ khỏi hồ sơ' })
  removeService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationServices.remove(id, itemId, user.userId);
  }

  @Post(':id/documents/:type')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Tải ảnh giấy tờ hoặc portfolio vào hồ sơ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  uploadDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('type', new ParseEnumPipe(ProviderDocumentType))
    type: ProviderDocumentType,
    @Query() query: ProviderDocumentQueryDto,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.upload(id, user.userId, type, query, file.buffer);
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Xóa tài liệu khỏi hồ sơ' })
  removeDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.remove(id, documentId, user.userId);
  }

  @Get(':id/documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Tạo URL tạm thời để xem tài liệu của chính mình' })
  accessDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.documents.getApplicantAccess(
      id,
      documentId,
      user.userId,
      request,
    );
  }

  @Post(':id/terms/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấp thuận điều khoản nhà cung cấp hiện hành' })
  acceptTerms(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AcceptProviderTermsDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.applications.acceptTerms(id, user.userId, dto, request);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra và gửi hồ sơ để xét duyệt' })
  submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.submit(id, user.userId);
  }

  @Post(':id/email/request-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 1, ttl: 60_000 },
    medium: { limit: 5, ttl: 3_600_000 },
  })
  @ApiOperation({ summary: 'Gửi mã xác minh email liên hệ của hồ sơ' })
  requestEmailCode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailVerification.requestCode(id, user.userId);
  }

  @Post(':id/email/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Xác minh email trước khi gửi hồ sơ' })
  verifyEmail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: VerifyProviderEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailVerification.confirmCode(id, user.userId, dto.code);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rút hồ sơ nháp hoặc hồ sơ cần bổ sung' })
  withdraw(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.withdraw(id, user.userId);
  }
}
