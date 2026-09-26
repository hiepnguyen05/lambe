import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { InternalRole } from '@prisma/client';
import 'multer';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  createImageUploadPipe,
  MAX_IMAGE_SIZE_BYTES,
} from '../../../common/http/files/image-upload.validation';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { ServiceImageService } from '../application/service-image.service';
import { ServicesCommandService } from '../application/services-command.service';
import { ServicesQueryService } from '../application/services-query.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { ServiceQueryDto } from '../dto/service-query.dto';
import { UpdateServiceStatusDto } from '../dto/update-service-status.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';

@ApiTags('Admin Services')
@ApiBearerAuth('internal-token')
@Controller('admin/services')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
export class AdminServicesController {
  constructor(
    private readonly servicesQuery: ServicesQueryService,
    private readonly servicesCommand: ServicesCommandService,
    private readonly serviceImage: ServiceImageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ chuẩn cho Admin' })
  findAll(@Query() query: ServiceQueryDto) {
    return this.servicesQuery.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết dịch vụ chuẩn theo ID' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.servicesQuery.findOneForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo dịch vụ chuẩn' })
  create(
    @Body() dto: CreateServiceDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.servicesCommand.create(dto, account.accountId, request);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái dịch vụ chuẩn' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateServiceStatusDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.servicesCommand.updateStatus(
      id,
      dto,
      account.accountId,
      request,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật nội dung và khung giá dịch vụ chuẩn' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.servicesCommand.update(id, dto, account.accountId, request);
  }

  @Post(':id/cover-image')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Tải ảnh bìa dịch vụ từ máy tính' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, WEBP hoặc GIF; tối đa 5 MB',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  uploadCoverImage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.serviceImage.uploadCover(
      id,
      file.buffer,
      account.accountId,
      request,
    );
  }

  @Delete(':id/cover-image')
  @ApiOperation({ summary: 'Xóa ảnh bìa dịch vụ' })
  removeCoverImage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.serviceImage.removeCover(id, account.accountId, request);
  }
}
