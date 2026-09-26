import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { CategoriesCommandService } from './application/categories-command.service';
import { CategoriesQueryService } from './application/categories-query.service';
import { CategoryCacheService } from './application/category-cache.service';
import { CategoryImageService } from './application/category-image.service';
import { CategoryUniquenessService } from './application/category-uniqueness.service';
import { ChangeCategoryStatusService } from './application/change-category-status.service';
import { CreateCategoryService } from './application/create-category.service';
import { ReorderCategoriesService } from './application/reorder-categories.service';
import { UpdateCategoryService } from './application/update-category.service';
import { AdminCategoriesController } from './controllers/admin-categories.controller';
import { PublicCategoriesController } from './controllers/public-categories.controller';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    CacheModule,
    InternalAuthModule,
    UploadModule,
  ],
  controllers: [AdminCategoriesController, PublicCategoriesController],
  providers: [
    CategoriesQueryService,
    CategoriesCommandService,
    CategoryCacheService,
    CategoryImageService,
    CategoryUniquenessService,
    CreateCategoryService,
    UpdateCategoryService,
    ChangeCategoryStatusService,
    ReorderCategoriesService,
  ],
})
export class CategoriesModule {}
