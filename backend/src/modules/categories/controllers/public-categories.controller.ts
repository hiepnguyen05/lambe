import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { categoryExample } from '../../../common/openapi/api-examples';
import {
  ApiNotFoundError,
  ApiStandardOk,
} from '../../../common/openapi/api-response.decorators';
import { CategoriesQueryService } from '../application/categories-query.service';
import { CategorySlugParamDto } from '../dto/category-slug-param.dto';

@ApiTags('Categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categoriesQuery: CategoriesQueryService) {}

  @Get()
  @ApiOperation({ summary: 'List active service categories' })
  @ApiStandardOk({
    description: 'Danh sách danh mục dịch vụ đang hoạt động.',
    data: [categoryExample],
  })
  findActive() {
    return this.categoriesQuery.findActive();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an active service category by slug' })
  @ApiStandardOk({
    description: 'Chi tiết danh mục dịch vụ đang hoạt động.',
    data: categoryExample,
  })
  @ApiNotFoundError('Danh mục')
  findActiveBySlug(@Param() params: CategorySlugParamDto) {
    return this.categoriesQuery.findActiveBySlug(params.slug);
  }
}
