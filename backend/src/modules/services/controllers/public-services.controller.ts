import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesQueryService } from '../application/services-query.service';
import { PublicServiceQueryDto } from '../dto/public-service-query.dto';
import { ServiceSlugParamDto } from '../dto/service-slug-param.dto';

@ApiTags('Services')
@Controller('services')
export class PublicServicesController {
  constructor(private readonly servicesQuery: ServicesQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ đang hoạt động' })
  findActive(@Query() query: PublicServiceQueryDto) {
    return this.servicesQuery.findActive(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Lấy dịch vụ đang hoạt động theo slug' })
  findActiveBySlug(@Param() params: ServiceSlugParamDto) {
    return this.servicesQuery.findActiveBySlug(params.slug);
  }
}
