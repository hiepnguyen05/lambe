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
import {
  documentAccessExample,
  providerApplicationExample,
  providerTermsExample,
} from '../../../common/openapi/api-examples';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiNotFoundError,
  ApiRateLimitError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
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
import { ProviderApplicationServicesService } from '../application/services/provider-application-services.service';
import { ProviderServiceSuggestionsService } from '../application/services/provider-service-suggestions.service';
import {
  CreateProviderServiceSuggestionDto,
  UpdateProviderServiceSuggestionDto,
} from '../dto/provider-service-suggestion.dto';

@ApiTags('Provider Applications')
@ApiBearerAuth('user-token')
@Controller('provider-applications')
@UseGuards(JwtAuthGuard)
export class ProviderApplicationsController {
  constructor(
    private readonly queryService: ProviderApplicationsQueryService,
    private readonly applications: ProviderApplicationsService,
    private readonly documents: ProviderApplicationDocumentsService,
    private readonly applicationServices: ProviderApplicationServicesService,
    private readonly serviceSuggestions: ProviderServiceSuggestionsService,
  ) {}

  @Get('terms/current')
  @ApiOperation({ summary: 'Lấy phiên bản điều khoản nhà cung cấp hiện hành' })
  @ApiStandardOk({
    description: 'Phiên bản điều khoản nhà cung cấp hiện hành.',
    data: providerTermsExample,
  })
  @ApiAuthenticationErrors()
  getCurrentTerms() {
    return { success: true, data: { version: CURRENT_PROVIDER_TERMS_VERSION } };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy các hồ sơ đăng ký của người dùng hiện tại' })
  @ApiStandardOk({
    description: 'Danh sách hồ sơ đăng ký đối tác của người dùng hiện tại.',
    data: [providerApplicationExample],
  })
  @ApiAuthenticationErrors()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.queryService.findMine(user.userId);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ đăng ký của chính mình' })
  @ApiStandardOk({
    description: 'Chi tiết hồ sơ đăng ký đối tác của người dùng hiện tại.',
    data: providerApplicationExample,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  findMineById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queryService.findMineById(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo bản nháp đăng ký nhà cung cấp' })
  @ApiStandardCreated({
    description:
      'Tạo hồ sơ nháp. Người dùng phải có tài khoản Lambe trước khi đăng ký làm đối tác.',
    data: providerApplicationExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Người dùng đang có hồ sơ đăng ký chưa kết thúc.')
  create(
    @Body() dto: CreateProviderApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ đăng ký' })
  @ApiStandardOk({
    description: 'Cập nhật thông tin hồ sơ đăng ký thành công.',
    data: providerApplicationExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProviderApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.update(id, user.userId, dto);
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Thêm dịch vụ và giá đề xuất vào hồ sơ' })
  @ApiStandardCreated({
    description: 'Thêm dịch vụ nhà cung cấp muốn nhận trong hồ sơ đăng ký.',
    data: providerApplicationExample.services[0],
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Dịch vụ đã có trong hồ sơ đăng ký.')
  @ApiNotFoundError('Hồ sơ đăng ký đối tác hoặc dịch vụ')
  addService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddProviderApplicationServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationServices.add(id, user.userId, dto);
  }

  @Patch(':id/services/:itemId')
  @ApiOperation({ summary: 'Cập nhật dịch vụ đã đăng ký' })
  @ApiStandardOk({
    description: 'Cập nhật giá, thời lượng hoặc mô tả dịch vụ trong hồ sơ.',
    data: providerApplicationExample.services[0],
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Dịch vụ trong hồ sơ')
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
  @ApiStandardOk({
    description: 'Xóa dịch vụ khỏi hồ sơ đăng ký.',
    message: 'Đã xóa dịch vụ khỏi hồ sơ.',
    data: null,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Dịch vụ trong hồ sơ')
  removeService(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationServices.remove(id, itemId, user.userId);
  }

  @Post(':id/service-suggestions')
  @ApiOperation({ summary: 'Đề xuất dịch vụ chưa có trong hệ thống' })
  @ApiStandardCreated({
    description: 'Lưu đề xuất trong hồ sơ đăng ký.',
    data: { id: 'uuid', status: 'PENDING' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiConflictError('Dịch vụ đã tồn tại hoặc đã được đề xuất.')
  addSuggestion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateProviderServiceSuggestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceSuggestions.add(id, user.userId, dto);
  }

  @Patch(':id/service-suggestions/:suggestionId')
  @ApiOperation({ summary: 'Sửa đề xuất dịch vụ trong hồ sơ' })
  @ApiStandardOk({
    description: 'Đề xuất đã được cập nhật.',
    data: { id: 'uuid', status: 'PENDING' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  updateSuggestion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('suggestionId', new ParseUUIDPipe({ version: '4' }))
    suggestionId: string,
    @Body() dto: UpdateProviderServiceSuggestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceSuggestions.update(id, suggestionId, user.userId, dto);
  }

  @Delete(':id/service-suggestions/:suggestionId')
  @ApiOperation({ summary: 'Xóa đề xuất dịch vụ khỏi hồ sơ' })
  @ApiStandardOk({ description: 'Đề xuất đã được xóa.', data: null })
  @ApiAuthenticationErrors()
  removeSuggestion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('suggestionId', new ParseUUIDPipe({ version: '4' }))
    suggestionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceSuggestions.remove(id, suggestionId, user.userId);
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
  @ApiStandardCreated({
    description:
      'Upload tài liệu KYC hoặc portfolio. Với chứng chỉ/portfolio có thể gắn applicationServiceId qua query.',
    data: providerApplicationExample.documents[0],
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiRateLimitError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description: 'Xóa tài liệu khỏi hồ sơ đăng ký.',
    message: 'Đã xóa tài liệu khỏi hồ sơ.',
    data: null,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Tài liệu')
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
  @ApiStandardOk({
    description:
      'Tạo URL tạm thời để xem tài liệu riêng tư. Frontend không lưu URL này lâu dài.',
    data: documentAccessExample,
  })
  @ApiAuthenticationErrors()
  @ApiRateLimitError()
  @ApiNotFoundError('Tài liệu')
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
  @ApiStandardOk({
    description: 'Ghi nhận người dùng đã chấp thuận điều khoản đối tác.',
    data: providerApplicationExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
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
  @ApiStandardOk({
    description:
      'Gửi hồ sơ sang hàng chờ kiểm duyệt sau khi đủ thông tin, giấy tờ, dịch vụ, email và điều khoản.',
    data: providerApplicationExample,
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.submit(id, user.userId);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rút hồ sơ nháp hoặc hồ sơ cần bổ sung' })
  @ApiStandardOk({
    description: 'Rút hồ sơ nháp hoặc hồ sơ đang cần bổ sung.',
    message: 'Đã rút hồ sơ đăng ký.',
    data: null,
  })
  @ApiAuthenticationErrors()
  @ApiNotFoundError('Hồ sơ đăng ký đối tác')
  withdraw(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.withdraw(id, user.userId);
  }
}
