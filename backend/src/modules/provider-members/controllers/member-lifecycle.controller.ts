import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiConflictError,
  ApiInternalAuthorizationErrors,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import {
  MEMBER_OPERATIONS_ROLES,
  MemberLifecycleService,
} from '../application/member-lifecycle.service';
import {
  ProviderMemberLifecycleDto,
  ProviderMemberOperationsQueryDto,
} from '../dto/provider-member-verification.dto';
import { memberExample } from './provider-members.examples';

@ApiTags('Provider Member Lifecycle')
@ApiBearerAuth('user-token')
@UseGuards(JwtAuthGuard)
@ApiAuthenticationErrors()
@ApiValidationError()
@ApiConflictError('Thành viên hoặc tổ chức chưa đủ điều kiện khôi phục.')
@Controller('me/provider/members')
export class MemberLifecycleController {
  constructor(private readonly lifecycle: MemberLifecycleService) {}

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Owner đình chỉ worker của tổ chức, có lý do và audit',
  })
  @ApiStandardOk({
    description: 'Không thay đổi owner, KYC, đơn hay bằng chứng cũ.',
    data: { ...memberExample, status: 'SUSPENDED' },
  })
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderMemberLifecycleDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.lifecycle.change(
      id,
      'suspend',
      dto.reason,
      { ownerUserId: user.userId },
      metadata,
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Owner khôi phục worker do mình đình chỉ',
    description:
      'Không gỡ đình chỉ INTERNAL. Worker chưa được duyệt quay về pending; ACTIVE phải còn KYC/chứng chỉ hợp lệ.',
  })
  @ApiStandardOk({
    description: 'Trả trạng thái sau khi kiểm tra lại điều kiện.',
    data: { ...memberExample, status: 'ACTIVE' },
  })
  reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderMemberLifecycleDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.lifecycle.change(
      id,
      'reactivate',
      dto.reason,
      { ownerUserId: user.userId },
      metadata,
    );
  }
}

@ApiTags('Admin Member Lifecycle')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(...MEMBER_OPERATIONS_ROLES)
@ApiInternalAuthorizationErrors()
@ApiValidationError()
@Controller('admin/provider-members')
export class AdminMemberLifecycleController {
  constructor(private readonly lifecycle: MemberLifecycleService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Vận hành xem thành viên/trạng thái đình chỉ, không truy cập KYC',
    description: 'Lọc providerId/status và phân trang page/limit.',
  })
  @ApiStandardOk({
    description: 'Không có CCCD, ngày sinh hoặc giấy tờ.',
    data: [memberExample],
  })
  list(
    @Query() query: ProviderMemberOperationsQueryDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
  ) {
    return this.lifecycle.listForOperations(query, account);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Vận hành đình chỉ worker; owner không thể tự gỡ khóa này',
  })
  @ApiStandardOk({
    description: 'Lưu audit người thao tác và lý do.',
    data: { ...memberExample, status: 'SUSPENDED' },
  })
  suspend(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderMemberLifecycleDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.lifecycle.change(
      id,
      'suspend',
      dto.reason,
      { internal: account },
      metadata,
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Vận hành khôi phục worker sau khi xử lý đình chỉ và kiểm tra lại KYC',
  })
  @ApiStandardOk({
    description: 'Không bỏ qua trạng thái pending hoặc chứng chỉ hết hạn.',
    data: { ...memberExample, status: 'ACTIVE' },
  })
  reactivate(
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderMemberLifecycleDto,
    @CurrentRequestMetadata() metadata: RequestMetadata,
  ) {
    return this.lifecycle.change(
      id,
      'reactivate',
      dto.reason,
      { internal: account },
      metadata,
    );
  }
}
