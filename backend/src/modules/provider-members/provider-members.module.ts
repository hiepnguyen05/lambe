import { Module } from '@nestjs/common';
import { MemberFinanceService } from './application/finance/member-finance.service';
import {
  OrganizationFinanceController,
  MemberCollectionsController,
} from './controllers/member-finance.controller';
import { MemberServingService } from './application/booking/member-serving.service';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { MemberServicesService } from './application/capabilities/member-services.service';
import { MemberScheduleService } from './application/capabilities/member-schedule.service';
import { MemberAvailabilityService } from './application/availability/member-availability.service';
import { MemberOrganizationReceivingService } from './application/availability/member-organization-receiving.service';
import { MemberCapabilitiesController } from './controllers/member-capabilities.controller';
import { MemberAvailabilityController } from './controllers/member-availability.controller';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { UploadModule } from '../upload/upload.module';
import { KycModule } from '../../infrastructure/kyc/kyc.module';
import { MemberVerificationService } from './application/verification/member-verification.service';
import { MemberVerificationDocumentsService } from './application/verification/member-verification-documents.service';
import { MemberVerificationReviewService } from './application/verification/member-verification-review.service';
import { MemberVerificationQueryService } from './application/verification/member-verification-query.service';
import { MemberVerificationRenewalService } from './application/verification/member-verification-renewal.service';
import { MemberLifecycleService } from './application/member-lifecycle.service';
import { MemberVerificationController } from './controllers/member-verification.controller';
import { AdminMemberVerificationController } from './controllers/admin-member-verification.controller';
import {
  AdminMemberLifecycleController,
  MemberLifecycleController,
} from './controllers/member-lifecycle.controller';
import { ProviderMemberAccessService } from './application/provider-member-access.service';
import { ProviderMembersService } from './application/provider-members.service';
import { ProviderMemberInvitationsService } from './application/invitations/provider-member-invitations.service';
import { ProviderInvitationResponseService } from './application/invitations/provider-invitation-response.service';
import { ProviderMembersController } from './controllers/provider-members.controller';
import { ProviderMemberInvitationsController } from './controllers/provider-member-invitations.controller';
import { ProviderInvitationResponseController } from './controllers/provider-invitation-response.controller';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    AuthModule,
    InternalAuthModule,
    UploadModule,
    KycModule,
    CacheModule,
  ],
  controllers: [
    OrganizationFinanceController,
    MemberCollectionsController,
    ProviderMembersController,
    ProviderMemberInvitationsController,
    ProviderInvitationResponseController,
    MemberVerificationController,
    AdminMemberVerificationController,
    MemberLifecycleController,
    AdminMemberLifecycleController,
    MemberCapabilitiesController,
    MemberAvailabilityController,
  ],
  providers: [
    MemberFinanceService,
    ProviderMemberAccessService,
    ProviderMembersService,
    ProviderMemberInvitationsService,
    ProviderInvitationResponseService,
    MemberVerificationService,
    MemberVerificationDocumentsService,
    MemberVerificationReviewService,
    MemberVerificationQueryService,
    MemberVerificationRenewalService,
    MemberLifecycleService,
    MemberServingService,
    MemberServicesService,
    MemberScheduleService,
    MemberAvailabilityService,
    MemberOrganizationReceivingService,
  ],
  exports: [MemberServingService],
})
export class ProviderMembersModule {}
