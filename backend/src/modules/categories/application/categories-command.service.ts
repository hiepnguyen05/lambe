import { Injectable } from '@nestjs/common';
import type { RequestMetadata } from '../../../common/http/types/request-metadata.type';
import type { CreateCategoryDto } from '../dto/create-category.dto';
import type { ReorderCategoriesDto } from '../dto/reorder-categories.dto';
import type { UpdateCategoryStatusDto } from '../dto/update-category-status.dto';
import type { UpdateCategoryDto } from '../dto/update-category.dto';
import { ChangeCategoryStatusService } from './change-category-status.service';
import { CreateCategoryService } from './create-category.service';
import { ReorderCategoriesService } from './reorder-categories.service';
import { UpdateCategoryService } from './update-category.service';

@Injectable()
export class CategoriesCommandService {
  constructor(
    private readonly createCategory: CreateCategoryService,
    private readonly updateCategory: UpdateCategoryService,
    private readonly changeStatus: ChangeCategoryStatusService,
    private readonly reorderCategories: ReorderCategoriesService,
  ) {}

  create(dto: CreateCategoryDto, actorId: string, request?: RequestMetadata) {
    return this.createCategory.execute(dto, actorId, request);
  }

  update(
    id: string,
    dto: UpdateCategoryDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.updateCategory.execute(id, dto, actorId, request);
  }

  updateStatus(
    id: string,
    dto: UpdateCategoryStatusDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.changeStatus.execute(id, dto, actorId, request);
  }

  reorder(
    dto: ReorderCategoriesDto,
    actorId: string,
    request?: RequestMetadata,
  ) {
    return this.reorderCategories.execute(dto, actorId, request);
  }
}
