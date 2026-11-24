import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { healthExample } from '../../common/openapi/api-examples';
import { ApiStandardOk } from '../../common/openapi/api-response.decorators';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  // Readiness must report Redis health even when Redis-backed throttling is down.
  @SkipThrottle({ short: true, medium: true })
  @ApiOperation({
    summary: 'Kiểm tra trạng thái server, PostgreSQL và Redis',
  })
  @ApiStandardOk({
    description: 'Trạng thái health check của hệ thống.',
    data: healthExample,
  })
  check() {
    return this.healthService.check();
  }
}
