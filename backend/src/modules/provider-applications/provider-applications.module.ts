import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { ProviderApplicationDocumentsService } from './application/documents/provider-application-documents.service';
import { KycCryptoService } from './application/kyc/kyc-crypto.service';
import { LegacyKycMigrationService } from './application/kyc/legacy-kyc-migration.service';
import { ProviderApplicationReviewService } from './application/review/provider-application-review.service';
import { ProviderApplicationNotificationService } from './application/notifications/provider-application-notification.service';
import { ProviderApplicationsQueryService } from './application/applications/provider-applications-query.service';
import { ProviderApplicationsService } from './application/applications/provider-applications.service';
import { ProviderEmailVerificationService } from './application/email-verification/provider-email-verification.service';
import { ProviderApplicationServicesService } from './application/services/provider-application-services.service';
import { AdminProviderApplicationsController } from './controllers/admin-provider-applications.controller';
import { ProviderApplicationsController } from './controllers/provider-applications.controller';

@Module({
  imports: [
    PostgresModule,
    AuthModule,
    InternalAuthModule,
    UploadModule,
    AuditModule,
    MailModule,
  ],
  controllers: [
    ProviderApplicationsController,
    AdminProviderApplicationsController,
  ],
  providers: [
    ProviderApplicationsQueryService,
    ProviderApplicationsService,
    ProviderEmailVerificationService,
    ProviderApplicationServicesService,
    ProviderApplicationDocumentsService,
    ProviderApplicationReviewService,
    ProviderApplicationNotificationService,
    KycCryptoService,
    LegacyKycMigrationService,
  ],
})
export class ProviderApplicationsModule {}
