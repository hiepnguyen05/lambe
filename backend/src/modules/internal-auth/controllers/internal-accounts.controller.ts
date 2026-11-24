import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import {
  ApiInternalAuthorizationErrors,
  ApiStandardCreated,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { InternalAccountsService } from '../application/internal-accounts.service';
import { CurrentInternalAccount } from '../decorators/current-internal-account.decorator';
import { InternalRoles } from '../decorators/internal-roles.decorator';
import {
  CreateInternalAccountDto,
  InternalAccountQueryDto,
  ReplaceInternalRolesDto,
  UpdateInternalAccountDto,
} from '../dto/internal-account.dto';
import { InternalJwtAuthGuard } from '../guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../types/authenticated-internal-account.type';

const accountExample = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'reviewer01',
  fullName: 'Nguyen Van A',
  email: 'reviewer@example.com',
  status: 'ACTIVE',
  roles: ['KYC_REVIEWER'],
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

@ApiTags('Internal Accounts')
@ApiBearerAuth('internal-token')
@Controller('admin/internal-accounts')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
@ApiInternalAuthorizationErrors()
export class InternalAccountsController {
  constructor(private readonly accounts: InternalAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List internal accounts' })
  @ApiStandardOk({
    description: 'Danh sach tai khoan noi bo.',
    data: [accountExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  list(@Query() query: InternalAccountQueryDto) {
    return this.accounts.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an internal account' })
  @ApiStandardOk({
    description: 'Chi tiet tai khoan noi bo.',
    data: accountExample,
  })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Invite an internal account' })
  @ApiStandardCreated({
    description: 'Da tao loi moi va xep hang email.',
    data: { ...accountExample, status: 'INVITED' },
  })
  create(
    @Body() dto: CreateInternalAccountDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.create(dto, actor, request);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an internal account' })
  @ApiStandardOk({
    description: 'Tai khoan da cap nhat.',
    data: accountExample,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInternalAccountDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.update(id, dto, actor, request);
  }

  @Put(':id/roles')
  @ApiOperation({ summary: 'Replace internal account roles' })
  @ApiStandardOk({
    description: 'Vai tro da cap nhat; session cu bi thu hoi.',
    data: accountExample,
  })
  replaceRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceInternalRolesDto,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.replaceRoles(id, dto.roles, actor, request);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable an internal account and revoke sessions' })
  @ApiStandardOk({
    description: 'Tai khoan da vo hieu hoa.',
    data: { ...accountExample, status: 'DISABLED' },
  })
  disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.setDisabled(id, true, actor, request);
  }

  @Post(':id/enable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enable an internal account' })
  @ApiStandardOk({
    description: 'Tai khoan da duoc bat lai.',
    data: accountExample,
  })
  enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.setDisabled(id, false, actor, request);
  }

  @Post(':id/password-reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a one-time password setup email' })
  @ApiStandardOk({
    description: 'Yeu cau da xep hang email; khong tra token.',
    data: null,
    message: 'Da tao yeu cau thiet lap mat khau va xep hang gui email.',
  })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.accounts.resetPassword(id, actor, request);
  }
}
