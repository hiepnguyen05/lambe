import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { serviceExample } from '../../../common/openapi/api-examples';
import {
  ApiNotFoundError,
  ApiStandardOk,
  ApiValidationError,
} from '../../../common/openapi/api-response.decorators';
import { ServicesQueryService } from '../application/services-query.service';
import { PublicServiceQueryDto } from '../dto/public-service-query.dto';
import { ServiceSlugParamDto } from '../dto/service-slug-param.dto';

@ApiTags('Services')
@Controller('services')
export class PublicServicesController {
  constructor(private readonly servicesQuery: ServicesQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ đang hoạt động' })
  @ApiStandardOk({
    description:
      'Danh sách dịch vụ đang hoạt động, có thể lọc theo danh mục, giới tính mục tiêu, từ khóa và giá tối đa.',
    data: [serviceExample],
  })
  @ApiValidationError()
  findActive(@Query() query: PublicServiceQueryDto) {
    return this.servicesQuery.findActive(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Lấy dịch vụ đang hoạt động theo slug' })
  @ApiStandardOk({
    description: 'Chi tiết dịch vụ đang hoạt động.',
    data: serviceExample,
  })
  @ApiNotFoundError('Dịch vụ')
  findActiveBySlug(@Param() params: ServiceSlugParamDto) {
    return this.servicesQuery.findActiveBySlug(params.slug);
  }
}
