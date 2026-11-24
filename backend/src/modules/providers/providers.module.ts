import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { AdminProviderManagementService } from './application/management/admin-provider-management.service';
import { ProviderSetupController } from './controllers/provider-setup.controller';
import { ProviderSetupService } from './application/provider-setup.service';
import { ProviderAvailabilityController } from './controllers/provider-availability.controller';
import { ProviderAvailabilityService } from './application/availability/provider-availability.service';
import { AdminProvidersController } from './controllers/admin-providers.controller';
import { ProviderServicesController } from './controllers/provider-services.controller';
import { ProviderServicesService } from './application/services/provider-services.service';
import { ProviderServiceChangesController } from './controllers/provider-service-changes.controller';
import { AdminProviderServiceChangesController } from './controllers/admin-provider-service-changes.controller';
import { ProviderServiceChangesService } from './application/services/provider-service-changes.service';
import { ProviderServiceChangeDocumentsService } from './application/services/provider-service-change-documents.service';
import { ProviderServiceChangeReviewService } from './application/services/provider-service-change-review.service';
import { ServicesModule } from '../services/services.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { PushModule } from '../push/push.module';
import { ProviderServiceChangeNotificationService } from './application/services/provider-service-change-notification.service';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    CacheModule,
    AuthModule,
    InternalAuthModule,
    UploadModule,
    ServicesModule,
    MailModule,
    PushModule,
  ],
  controllers: [
    ProviderSetupController,
    ProviderAvailabilityController,
    ProviderServicesController,
    ProviderServiceChangesController,
    AdminProviderServiceChangesController,
    AdminProvidersController,
  ],
  providers: [
    ProviderSetupService,
    ProviderAvailabilityService,
    ProviderServicesService,
    ProviderServiceChangesService,
    ProviderServiceChangeDocumentsService,
    ProviderServiceChangeReviewService,
    ProviderServiceChangeNotificationService,
    AdminProviderManagementService,
  ],
  exports: [AdminProviderManagementService],
})
export class ProvidersModule {}
