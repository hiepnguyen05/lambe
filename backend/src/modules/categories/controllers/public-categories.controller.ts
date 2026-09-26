import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesQueryService } from '../application/categories-query.service';
import { CategorySlugParamDto } from '../dto/category-slug-param.dto';

@ApiTags('Categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categoriesQuery: CategoriesQueryService) {}

  @Get()
  @ApiOperation({ summary: 'List active service categories' })
  findActive() {
    return this.categoriesQuery.findActive();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an active service category by slug' })
  findActiveBySlug(@Param() params: CategorySlugParamDto) {
    return this.categoriesQuery.findActiveBySlug(params.slug);
  }
}
