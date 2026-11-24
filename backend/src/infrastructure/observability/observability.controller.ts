import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalRole } from '@prisma/client';
import {
  ApiDependencyUnavailableError,
  ApiInternalAuthorizationErrors,
  ApiRateLimitError,
  ApiStandardOk,
} from '../../common/openapi/api-response.decorators';
import { InternalRoles } from '../../modules/internal-auth/decorators/internal-roles.decorator';
import { InternalJwtAuthGuard } from '../../modules/internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../modules/internal-auth/guards/internal-roles.guard';
import { ObservabilityService } from './observability.service';

@ApiTags('Admin Observability')
@ApiBearerAuth('internal-token')
@UseGuards(InternalJwtAuthGuard, InternalRolesGuard)
@InternalRoles(InternalRole.ADMIN)
@Controller('admin/observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Read process-local operational aggregates and bounded queue health',
  })
  @ApiStandardOk({
    description:
      'Process-local operational aggregates; dependency samples are cached for five seconds and capped queue counts identify lower bounds.',
    data: {
      scope: 'process-local-since-start',
      process: { uptimeSeconds: 120 },
      http: { active: 1, routes: [] },
      dependencies: {
        sampledAt: '2026-10-30T00:00:00.000Z',
        postgres: {
          status: 'up',
          rowLimit: 10000,
          push: {
            pending: 0,
            retry: 0,
            failed: 0,
            backlog: 0,
            countsAreLowerBounds: false,
            oldestAgeSeconds: null,
          },
          orderNotices: {
            unpublished: 0,
            countIsLowerBound: false,
            oldestAgeSeconds: null,
          },
        },
        redis: { status: 'up' },
      },
      alerts: [],
    },
  })
  @ApiInternalAuthorizationErrors()
  @ApiRateLimitError()
  @ApiDependencyUnavailableError(
    'Redis-backed rate protection can reject dashboard requests while Redis is unavailable.',
  )
  snapshot() {
    return this.observability.snapshot();
  }
}
