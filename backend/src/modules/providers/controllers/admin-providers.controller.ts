import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import {
  ApiInternalAuthorizationErrors,
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminProviderManagementService } from '../application/management/admin-provider-management.service';
import {
  AdminProviderQueryDto,
  UpdateAdminProviderStatusDto,
} from '../dto/admin-provider-management.dto';

@ApiTags('Admin Providers')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.MODERATOR, InternalRole.SUPPORT)
@Controller('admin/providers')
export class AdminProvidersController {
  constructor(private readonly service: AdminProviderManagementService) {}

  @Get()
  @ApiOperation({
    summary: 'Tìm kiếm và lọc chuyên viên, đối tác đã được duyệt',
  })
  @ApiStandardOk({
    description: 'Danh sách provider có phân trang và thống kê.',
    data: [],
    meta: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      summary: {
        total: 0,
        setupRequired: 0,
        active: 0,
        suspended: 0,
        individuals: 0,
        organizations: 0,
      },
    },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  findAll(@Query() query: AdminProviderQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ vận hành của chuyên viên hoặc đối tác' })
  @ApiStandardOk({
    description: 'Thông tin hồ sơ, dịch vụ, lịch làm việc và ví.',
    data: {},
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Nhà cung cấp')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.service.findOne(id, account.accountId, request);
  }

  @Patch(':id/status')
  @InternalRoles(InternalRole.ADMIN, InternalRole.MODERATOR)
  @ApiOperation({
    summary: 'Đình chỉ hoặc khôi phục hoạt động của nhà cung cấp',
  })
  @ApiStandardOk({
    description: 'Cập nhật trạng thái provider thành công.',
    data: {},
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Nhà cung cấp')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAdminProviderStatusDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.service.updateStatus(id, dto, account.accountId, request);
  }
}
