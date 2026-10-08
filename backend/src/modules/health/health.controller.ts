import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { healthExample } from '../../common/openapi/api-examples';
import { ApiStandardOk } from '../../common/openapi/api-response.decorators';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
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
