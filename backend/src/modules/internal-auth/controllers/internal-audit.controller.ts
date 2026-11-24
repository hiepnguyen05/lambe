import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import {
  ApiInternalAuthorizationErrors,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { InternalAuditQueryService } from '../application/internal-audit-query.service';
import { InternalRoles } from '../decorators/internal-roles.decorator';
import { InternalAuditQueryDto } from '../dto/internal-audit-query.dto';
import { InternalJwtAuthGuard } from '../guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../guards/internal-roles.guard';

const auditExample = {
  id: '11111111-1111-4111-8111-111111111111',
  actorInternalAccountId: '22222222-2222-4222-8222-222222222222',
  actorUserId: null,
  action: 'INTERNAL_ACCOUNT_CREATED',
  resourceType: 'InternalAccount',
  resourceId: '33333333-3333-4333-8333-333333333333',
  result: 'SUCCESS',
  requestId: null,
  createdAt: '2026-10-18T12:00:00.000Z',
};

@ApiTags('Internal Audit')
@ApiBearerAuth('internal-token')
@Controller('admin/audit-logs')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
@ApiInternalAuthorizationErrors()
export class InternalAuditController {
  constructor(private readonly audit: InternalAuditQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Search redacted audit records' })
  @ApiStandardOk({
    description: 'Nhat ky thao tac da loai metadata va thong tin thiet bi.',
    data: [auditExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  list(@Query() query: InternalAuditQueryDto) {
    return this.audit.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a redacted audit record' })
  @ApiStandardOk({
    description: 'Chi tiet nhat ky da loc thong tin nhay cam.',
    data: auditExample,
  })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(id);
  }
}
