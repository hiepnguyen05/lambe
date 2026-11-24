import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { ProviderApplicationDocumentsService } from './application/documents/provider-application-documents.service';
import { KycModule } from '../../infrastructure/kyc/kyc.module';
import { ProviderApplicationReviewService } from './application/review/provider-application-review.service';
import { ProviderApplicationNotificationService } from './application/notifications/provider-application-notification.service';
import { ProviderApplicationsQueryService } from './application/applications/provider-applications-query.service';
import { ProviderApplicationsService } from './application/applications/provider-applications.service';
import { ProviderApplicationServicesService } from './application/services/provider-application-services.service';
import { ProviderServiceSuggestionsService } from './application/services/provider-service-suggestions.service';
import { ReviewProviderServiceSuggestionService } from './application/services/review-provider-service-suggestion.service';
import { ServicesModule } from '../services/services.module';
import { PushModule } from '../push/push.module';
import { AdminProviderApplicationsController } from './controllers/admin-provider-applications.controller';
import { ProviderApplicationsController } from './controllers/provider-applications.controller';

@Module({
  imports: [
    KycModule,
    PostgresModule,
    AuthModule,
    InternalAuthModule,
    UploadModule,
    AuditModule,
    MailModule,
    ServicesModule,
    PushModule,
  ],
  controllers: [
    ProviderApplicationsController,
    AdminProviderApplicationsController,
  ],
  providers: [
    ProviderApplicationsQueryService,
    ProviderApplicationsService,
    ProviderApplicationServicesService,
    ProviderServiceSuggestionsService,
    ReviewProviderServiceSuggestionService,
    ProviderApplicationDocumentsService,
    ProviderApplicationReviewService,
    ProviderApplicationNotificationService,
  ],
})
export class ProviderApplicationsModule {}
