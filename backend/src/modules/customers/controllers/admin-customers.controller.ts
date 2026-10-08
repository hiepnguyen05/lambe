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
  adminCustomerActivityExample,
  adminCustomerExample,
  customerProviderApplicationSummaryExample,
} from '../../../common/openapi/api-examples';
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
import { ChangeCustomerStatusService } from '../application/management/change-customer-status.service';
import { CustomerManagementQueryService } from '../application/management/customer-management-query.service';
import {
  CustomerActivityQueryDto,
  CustomerQueryDto,
  UpdateCustomerStatusDto,
} from '../dto/customer-management.dto';

@ApiTags('Admin Customers')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    private readonly queryService: CustomerManagementQueryService,
    private readonly statusService: ChangeCustomerStatusService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Tìm kiếm và lọc danh sách khách hàng',
    description:
      'Chỉ trả dữ liệu tóm tắt. Hỗ trợ lọc trạng thái tài khoản, onboarding, giới tính và trạng thái đối tác.',
  })
  @ApiStandardOk({
    description: 'Danh sách khách hàng có phân trang.',
    data: [adminCustomerExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  findAll(@Query() query: CustomerQueryDto) {
    return this.queryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ quản trị của một khách hàng' })
  @ApiStandardOk({
    description:
      'Thông tin khách hàng, onboarding, địa chỉ và trạng thái đối tác. Việc truy cập được ghi audit log.',
    data: adminCustomerExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Khách hàng')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.queryService.findOne(id, account.accountId, request);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Xem lịch sử hoạt động và quản trị khách hàng' })
  @ApiStandardOk({
    description: 'Danh sách audit log liên quan tới khách hàng.',
    data: [adminCustomerActivityExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Khách hàng')
  findActivity(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: CustomerActivityQueryDto,
  ) {
    return this.queryService.findActivity(id, query);
  }

  @Get(':id/provider-applications')
  @ApiOperation({ summary: 'Xem các hồ sơ đăng ký đối tác của khách hàng' })
  @ApiStandardOk({
    description:
      'Chỉ trả thông tin tổng quan, không trả CCCD hoặc tài liệu KYC.',
    data: [customerProviderApplicationSummaryExample],
  })
  @ApiInternalAuthorizationErrors()
  @ApiNotFoundError('Khách hàng')
  findProviderApplications(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.queryService.findProviderApplications(
      id,
      account.accountId,
      request,
    );
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Thay đổi trạng thái tài khoản khách hàng',
    description:
      'ADMIN được đặt mọi trạng thái. SUPPORT chỉ được khóa hoặc mở khóa. Khi vô hiệu hóa tài khoản đối tác, phiên online cũng bị kết thúc.',
  })
  @ApiStandardOk({
    description: 'Cập nhật trạng thái tài khoản thành công.',
    message: 'Cập nhật trạng thái khách hàng thành công.',
    data: adminCustomerExample,
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  @ApiNotFoundError('Khách hàng')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.statusService.execute(
      id,
      dto,
      account.accountId,
      account.roles,
      request,
    );
  }
}
