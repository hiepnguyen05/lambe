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
import { ProviderServiceChangesService } from '../application/services/provider-service-changes.service';
import { ProviderServiceChangeDocumentsService } from '../application/services/provider-service-change-documents.service';
import {
  CreateProviderServiceChangeDto,
  ProviderServiceChangeQueryDto,
  UpdateProviderServiceChangeDto,
} from '../dto/provider-service-change.dto';

@ApiTags('Provider Service Changes')
@ApiBearerAuth('user-token')
@Controller('me/provider/service-change-requests')
@UseGuards(JwtAuthGuard)
export class ProviderServiceChangesController {
  constructor(
    private readonly changes: ProviderServiceChangesService,
    private readonly documents: ProviderServiceChangeDocumentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đề xuất thay đổi dịch vụ của mình' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProviderServiceChangeQueryDto,
  ) {
    return this.changes.listMine(user.userId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo bản nháp thêm dịch vụ hoặc thay đổi giá, thời lượng, mô tả',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProviderServiceChangeDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.changes.create(user.userId, dto, request);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề xuất dịch vụ của mình' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.changes.findMine(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa bản nháp hoặc yêu cầu cần bổ sung' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProviderServiceChangeDto,
  ) {
    return this.changes.update(user.userId, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi đề xuất đến bộ phận kiểm duyệt' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.changes.submit(user.userId, id, request);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rút đề xuất chưa được duyệt' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.changes.withdraw(user.userId, id, request);
  }

  @Post(':id/documents/:type')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Tải riêng tư chứng chỉ hoặc ảnh portfolio cho đề xuất',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('type', new ParseEnumPipe(ProviderDocumentType))
    type: ProviderDocumentType,
    @UploadedFile(createImageUploadPipe({ allowSvg: false }))
    file: Express.Multer.File,
  ) {
    return this.documents.upload(user.userId, id, type, file.buffer);
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Xóa tài liệu khỏi bản nháp đề xuất' })
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    return this.documents.remove(user.userId, id, documentId);
  }

  @Get(':id/documents/:documentId/access')
  @Header('Cache-Control', 'no-store')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'URL tạm thời xem tài liệu riêng tư của mình' })
  accessDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.documents.access(id, documentId, request, user.userId);
  }
}
