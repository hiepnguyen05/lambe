import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole, VoucherIssuer } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiAuthenticationErrors,
  ApiInternalAuthorizationErrors,
  ApiStandardCreated,
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
import { VoucherService } from '../application/pricing/voucher.service';
import {
  CreateVoucherDto,
  EligibleVouchersQueryDto,
  VoucherListQueryDto,
} from '../dto/voucher.dto';

@ApiTags('Customer Vouchers')
@ApiBearerAuth('user-token')
@Controller('me/vouchers')
@UseGuards(JwtAuthGuard)
export class CustomerVouchersController {
  constructor(private readonly vouchers: VoucherService) {}

  @Get()
  @ApiOperation({ summary: 'Voucher có thể dùng cho dịch vụ của thợ đã chọn' })
  @ApiStandardOk({
    description: 'Voucher còn hiệu lực; kết quả chưa giữ lượt sử dụng.',
    data: [],
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EligibleVouchersQueryDto,
  ) {
    return this.vouchers.eligible(user.userId, query.providerServiceId);
  }
}

@ApiTags('Provider Vouchers')
@ApiBearerAuth('user-token')
@Controller('me/provider/vouchers')
@UseGuards(JwtAuthGuard)
export class ProviderVouchersController {
  constructor(private readonly vouchers: VoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Thợ tạo voucher cho dịch vụ của mình' })
  @ApiStandardCreated({
    description: 'Voucher của thợ được tạo.',
    data: { code: 'THO10', issuer: 'PROVIDER' },
  })
  @ApiAuthenticationErrors()
  @ApiValidationError()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVoucherDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.vouchers.create(
      VoucherIssuer.PROVIDER,
      user.userId,
      dto,
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách voucher do thợ tạo' })
  @ApiStandardOk({ description: 'Voucher thuộc hồ sơ thợ hiện tại.', data: [] })
  @ApiAuthenticationErrors()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: VoucherListQueryDto,
  ) {
    return this.vouchers.list(VoucherIssuer.PROVIDER, user.userId, query);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ngừng voucher của thợ' })
  @ApiStandardOk({
    description: 'Voucher ngừng áp dụng cho đơn mới.',
    data: null,
  })
  @ApiAuthenticationErrors()
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.vouchers.disable(
      VoucherIssuer.PROVIDER,
      user.userId,
      id,
      request,
    );
  }
}

@ApiTags('Admin Vouchers')
@ApiBearerAuth('internal-token')
@Controller('admin/vouchers')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
export class AdminVouchersController {
  constructor(private readonly vouchers: VoucherService) {}

  @Post()
  @ApiOperation({ summary: 'Admin tạo voucher nền tảng' })
  @ApiStandardCreated({
    description: 'Voucher nền tảng được tạo.',
    data: { code: 'LAMBE20', issuer: 'PLATFORM' },
  })
  @ApiInternalAuthorizationErrors()
  @ApiValidationError()
  create(
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @Body() dto: CreateVoucherDto,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.vouchers.create(
      VoucherIssuer.PLATFORM,
      actor.accountId,
      dto,
      request,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Admin xem danh sách voucher' })
  @ApiStandardOk({ description: 'Danh sách voucher phân trang.', data: [] })
  @ApiInternalAuthorizationErrors()
  list(
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @Query() query: VoucherListQueryDto,
  ) {
    return this.vouchers.list(VoucherIssuer.PLATFORM, actor.accountId, query);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin ngừng voucher bất kỳ' })
  @ApiStandardOk({
    description: 'Voucher ngừng áp dụng cho đơn mới.',
    data: null,
  })
  @ApiInternalAuthorizationErrors()
  disable(
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.vouchers.disable(
      VoucherIssuer.PLATFORM,
      actor.accountId,
      id,
      request,
    );
  }
}
