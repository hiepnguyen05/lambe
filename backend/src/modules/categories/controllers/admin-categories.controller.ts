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
import { adminCategoryExample } from '../../../common/openapi/api-examples';
import {
  ApiConflictError,
  ApiInternalAuthorizationErrors,
  ApiNotFoundError,
  ApiRateLimitError,
  ApiStandardCreated,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { CategoriesCommandService } from '../application/categories-command.service';
import { CategoryImageService } from '../application/category-image.service';
import { CategoriesQueryService } from '../application/categories-query.service';
import { CategoryQueryDto } from '../dto/category-query.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { ReorderCategoriesDto } from '../dto/reorder-categories.dto';
import { UpdateCategoryStatusDto } from '../dto/update-category-status.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@ApiTags('Admin Categories')
@ApiBearerAuth('internal-token')
@Controller('admin/categories')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
export class AdminCategoriesController {
  constructor(
    private readonly categoriesQuery: CategoriesQueryService,
    private readonly categoriesCommand: CategoriesCommandService,
    private readonly categoryImage: CategoryImageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục phân trang dành cho Admin' })
  @ApiStandardOk({
    description: 'Danh sách danh mục có phân trang.',
    data: [adminCategoryExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  @ApiInternalAuthorizationErrors()
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesQuery.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết danh mục theo ID' })
  @ApiStandardOk({
    description: 'Chi tiết danh mục dành cho Admin.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Danh mục')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.categoriesQuery.findOneForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới danh mục dịch vụ' })
  @ApiStandardCreated({
    description: 'Tạo danh mục dịch vụ thành công.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiConflictError('Mã, tên hoặc slug danh mục đã tồn tại.')
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoriesCommand.create(
      dto,
      account.accountId,
      requestMetadata,
    );
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Thay đổi thứ tự hiển thị danh mục (Sort Order)' })
  @ApiStandardOk({
    description: 'Sắp xếp danh mục thành công.',
    data: [adminCategoryExample],
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  reorder(
    @Body() dto: ReorderCategoriesDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoriesCommand.reorder(
      dto,
      account.accountId,
      requestMetadata,
    );
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cập nhật trạng thái danh mục (ACTIVE, INACTIVE, ARCHIVED)',
  })
  @ApiStandardOk({
    description: 'Cập nhật trạng thái danh mục thành công.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Danh mục')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCategoryStatusDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoriesCommand.updateStatus(
      id,
      dto,
      account.accountId,
      requestMetadata,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin danh mục dịch vụ' })
  @ApiStandardOk({
    description: 'Cập nhật danh mục thành công.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiConflictError('Mã, tên hoặc slug danh mục đã tồn tại.')
  @ApiNotFoundError('Danh mục')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoriesCommand.update(
      id,
      dto,
      account.accountId,
      requestMetadata,
    );
  }

  @Post(':id/cover-image')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Tải ảnh bìa danh mục từ máy tính' })
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
  @ApiStandardOk({
    description: 'Tải ảnh bìa danh mục thành công.',
    message: 'Cập nhật ảnh danh mục thành công.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiRateLimitError()
  @ApiNotFoundError('Danh mục')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  uploadCoverImage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile(createImageUploadPipe()) file: Express.Multer.File,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoryImage.uploadCover(
      id,
      file.buffer,
      account.accountId,
      requestMetadata,
    );
  }

  @Delete(':id/cover-image')
  @ApiOperation({ summary: 'Xóa ảnh bìa của danh mục' })
  @ApiStandardOk({
    description: 'Xóa ảnh bìa danh mục thành công.',
    message: 'Xóa ảnh danh mục thành công.',
    data: adminCategoryExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Danh mục')
  removeCoverImage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() requestMetadata: RequestMetadata,
  ) {
    return this.categoryImage.removeCover(
      id,
      account.accountId,
      requestMetadata,
    );
  }
}
