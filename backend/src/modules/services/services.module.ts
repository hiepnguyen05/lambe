import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { ChangeServiceStatusService } from './application/change-service-status.service';
import { CreateServiceService } from './application/create-service.service';
import { ReorderServicesService } from './application/reorder-services.service';
import { ServiceCacheService } from './application/service-cache.service';
import { ServiceImageService } from './application/service-image.service';
import { ServiceUniquenessService } from './application/service-uniqueness.service';
import { ServicesCommandService } from './application/services-command.service';
import { ServicesQueryService } from './application/services-query.service';
import { UpdateServiceService } from './application/update-service.service';
import { AdminServiceOrderingController } from './controllers/admin-service-ordering.controller';
import { AdminServicesController } from './controllers/admin-services.controller';
import { PublicServicesController } from './controllers/public-services.controller';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    CacheModule,
    InternalAuthModule,
    UploadModule,
  ],
  controllers: [
    AdminServicesController,
    AdminServiceOrderingController,
    PublicServicesController,
  ],
  providers: [
    ServicesQueryService,
    ServicesCommandService,
    ServiceCacheService,
    ServiceImageService,
    ServiceUniquenessService,
    CreateServiceService,
    UpdateServiceService,
    ChangeServiceStatusService,
    ReorderServicesService,
  ],
})
export class ServicesModule {}
