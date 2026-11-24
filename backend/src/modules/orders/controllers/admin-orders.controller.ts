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
import { CurrentRequestMetadata } from '../../../common/http/decorators/current-request-metadata.decorator';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import { CurrentInternalAccount } from '../../internal-auth/decorators/current-internal-account.decorator';
import { InternalRoles } from '../../internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../internal-auth/guards/internal-roles.guard';
import type { AuthenticatedInternalAccount } from '../../internal-auth/types/authenticated-internal-account.type';
import { AdminOrderQueryService } from '../application/operations/admin-order-query.service';
import { AdminOrderQueryDto } from '../dto/admin-order-query.dto';

const orderExample = {
  id: '11111111-1111-4111-8111-111111111111',
  customerId: '22222222-2222-4222-8222-222222222222',
  providerId: '33333333-3333-4333-8333-333333333333',
  bookingType: 'SCHEDULED',
  status: 'ACCEPTED',
  serviceName: 'Cat toc nam',
  totalAmount: 150000,
  currencyCode: 'VND',
  expectedStartAt: '2026-10-18T12:00:00.000Z',
  expectedEndAt: '2026-10-18T13:00:00.000Z',
  createdAt: '2026-10-18T10:00:00.000Z',
};

@ApiTags('Admin Orders')
@ApiBearerAuth('internal-token')
@Controller('admin/orders')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN, InternalRole.SUPPORT, InternalRole.MODERATOR)
@ApiInternalAuthorizationErrors()
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrderQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Search service orders for operations' })
  @ApiStandardOk({
    description: 'Danh sach don da loc thong tin lien he.',
    data: [orderExample],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  list(@Query() query: AdminOrderQueryDto) {
    return this.orders.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order detail and timeline with role-based redaction',
  })
  @ApiStandardOk({
    description:
      'Chi tiet don; contact/address chinh xac chi cho ADMIN va duoc audit.',
    data: {
      ...orderExample,
      timeline: [
        {
          kind: 'STATUS',
          at: '2026-10-18T10:00:00.000Z',
          id: '44444444-4444-4444-8444-444444444444',
          value: 'PENDING_PROVIDER',
          reason: null,
        },
      ],
    },
  })
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.get(id, actor, request);
  }

  @Get(':id/evidence/:evidenceId')
  @InternalRoles(InternalRole.ADMIN)
  @ApiOperation({ summary: 'Get a short-lived private evidence URL' })
  @ApiStandardOk({
    description: 'URL anh rieng tu, co thoi han ngan va ghi audit; chi ADMIN.',
    data: {
      id: '55555555-5555-4555-8555-555555555555',
      type: 'ARRIVAL',
      capturedAt: '2026-10-18T12:00:00.000Z',
      url: 'https://media.example/signed',
    },
  })
  evidenceUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentInternalAccount() actor: AuthenticatedInternalAccount,
    @CurrentRequestMetadata() request: RequestMetadata,
  ) {
    return this.orders.evidenceUrl(id, evidenceId, actor, request);
  }
}
