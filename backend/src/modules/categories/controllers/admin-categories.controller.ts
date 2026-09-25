import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { CategoriesCommandService } from '../application/categories-command.service';
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
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục phân trang dành cho Admin' })
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesQuery.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết danh mục theo ID' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.categoriesQuery.findOneForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo mới danh mục dịch vụ' })
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
}
