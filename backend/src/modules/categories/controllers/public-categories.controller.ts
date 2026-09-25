import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesQueryService } from '../application/categories-query.service';

@ApiTags('Categories')
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categoriesQuery: CategoriesQueryService) {}

  @Get()
  @ApiOperation({ summary: 'List active service categories' })
  findActive() {
    return this.categoriesQuery.findActive();
  }
}
