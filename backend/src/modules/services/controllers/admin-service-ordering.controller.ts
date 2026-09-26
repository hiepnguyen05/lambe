import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ServicesCommandService } from '../application/services-command.service';
import { ReorderServicesDto } from '../dto/reorder-services.dto';

@ApiTags('Admin Services')
@ApiBearerAuth('internal-token')
@Controller('admin/categories/:categoryId/services')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
export class AdminServiceOrderingController {
  constructor(private readonly servicesCommand: ServicesCommandService) {}

  @Patch('reorder')
  @ApiOperation({ summary: 'Sắp xếp dịch vụ trong một danh mục' })
  reorder(
    @Param('categoryId', new ParseUUIDPipe({ version: '4' }))
    categoryId: string,
    @Body() dto: ReorderServicesDto,
    @CurrentInternalAccount() account: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.servicesCommand.reorder(
      categoryId,
      dto,
      account.accountId,
      request,
    );
  }
}
