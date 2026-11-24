import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { App } from 'supertest/types';
import { TransformInterceptor } from '../../src/common/http/interceptors/transform.interceptor';
import { AuditService } from '../../src/infrastructure/audit/audit.service';
import { KycCryptoService } from '../../src/infrastructure/kyc/kyc-crypto.service';
import { PrismaService } from '../../src/infrastructure/persistence/postgres/prisma.service';
import { requireIsolatedTestDatabase } from './isolated-test-database';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { InternalAccessVerifierService } from '../../src/modules/internal-auth/application/internal-access-verifier.service';
import { InternalJwtAuthGuard } from '../../src/modules/internal-auth/guards/internal-jwt-auth.guard';
import { InternalRolesGuard } from '../../src/modules/internal-auth/guards/internal-roles.guard';
import { ProviderMemberAccessService } from '../../src/modules/provider-members/application/provider-member-access.service';
import { ProviderMembersService } from '../../src/modules/provider-members/application/provider-members.service';
import { ProviderMemberInvitationsService } from '../../src/modules/provider-members/application/invitations/provider-member-invitations.service';
import { ProviderInvitationResponseService } from '../../src/modules/provider-members/application/invitations/provider-invitation-response.service';
import { MemberLifecycleService } from '../../src/modules/provider-members/application/member-lifecycle.service';
import { MemberVerificationService } from '../../src/modules/provider-members/application/verification/member-verification.service';
import { MemberVerificationQueryService } from '../../src/modules/provider-members/application/verification/member-verification-query.service';
import { MemberVerificationReviewService } from '../../src/modules/provider-members/application/verification/member-verification-review.service';
import { MemberVerificationDocumentsService } from '../../src/modules/provider-members/application/verification/member-verification-documents.service';
import { MemberVerificationRenewalService } from '../../src/modules/provider-members/application/verification/member-verification-renewal.service';
import { ProviderMembersController } from '../../src/modules/provider-members/controllers/provider-members.controller';
import { ProviderMemberInvitationsController } from '../../src/modules/provider-members/controllers/provider-member-invitations.controller';
import { ProviderInvitationResponseController } from '../../src/modules/provider-members/controllers/provider-invitation-response.controller';
import { MemberVerificationController } from '../../src/modules/provider-members/controllers/member-verification.controller';
import { AdminMemberVerificationController } from '../../src/modules/provider-members/controllers/admin-member-verification.controller';
import {
  AdminMemberLifecycleController,
  MemberLifecycleController,
} from '../../src/modules/provider-members/controllers/member-lifecycle.controller';
import { MEDIA_STORAGE } from '../../src/modules/upload/application/media-storage.port';
import {
  MEMBER_LOCATION_STORE,
  type MemberLocationStore,
} from '../../src/infrastructure/location/member-location.store';
import { MemberServicesService } from '../../src/modules/provider-members/application/capabilities/member-services.service';
import { MemberScheduleService } from '../../src/modules/provider-members/application/capabilities/member-schedule.service';
import { MemberAvailabilityService } from '../../src/modules/provider-members/application/availability/member-availability.service';
import { MemberOrganizationReceivingService } from '../../src/modules/provider-members/application/availability/member-organization-receiving.service';
import { MemberCapabilitiesController } from '../../src/modules/provider-members/controllers/member-capabilities.controller';
import { MemberAvailabilityController } from '../../src/modules/provider-members/controllers/member-availability.controller';

export async function createMemberVerificationTestApp(
  locations?: MemberLocationStore,
) {
  requireIsolatedTestDatabase(process.env);
  const url = process.env.TEST_DATABASE_URL;
  const prisma = new PrismaService({ datasources: { db: { url } } });
  const media = {
    uploadPrivateImage: jest.fn().mockImplementation(() =>
      Promise.resolve({
        publicId: `test/member-private/${randomUUID()}`,
        secureUrl: 'https://example.test/private',
        format: 'png',
        deliveryType: 'authenticated',
        resourceType: 'image',
      }),
    ),
    createPrivateDownloadUrl: jest
      .fn()
      .mockReturnValue('https://example.test/expiring-signed-image'),
    deleteImage: jest.fn().mockResolvedValue(true),
  };
  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: 'member-verification-integration-test-only',
      }),
    ],
    controllers: [
      ProviderMembersController,
      ProviderMemberInvitationsController,
      ProviderInvitationResponseController,
      MemberVerificationController,
      AdminMemberVerificationController,
      MemberLifecycleController,
      AdminMemberLifecycleController,
      ...(locations
        ? [MemberCapabilitiesController, MemberAvailabilityController]
        : []),
    ],
    providers: [
      { provide: PrismaService, useValue: prisma },
      {
        provide: ConfigService,
        useValue: new ConfigService({
          kyc: { encryptionKey: Buffer.alloc(32, 7).toString('base64') },
        }),
      },
      { provide: MEDIA_STORAGE, useValue: media },
      AuditService,
      KycCryptoService,
      JwtAuthGuard,
      InternalAccessVerifierService,
      InternalJwtAuthGuard,
      InternalRolesGuard,
      ProviderMemberAccessService,
      ProviderMembersService,
      ProviderMemberInvitationsService,
      ProviderInvitationResponseService,
      MemberLifecycleService,
      MemberVerificationService,
      MemberVerificationQueryService,
      MemberVerificationReviewService,
      MemberVerificationDocumentsService,
      MemberVerificationRenewalService,
      ...(locations
        ? [
            { provide: MEMBER_LOCATION_STORE, useValue: locations },
            MemberServicesService,
            MemberScheduleService,
            MemberAvailabilityService,
            MemberOrganizationReceivingService,
          ]
        : []),
    ],
  }).compile();
  const app = module.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useLogger(false);
  await app.init();
  await app.listen(0, '127.0.0.1');
  return {
    app,
    prisma,
    jwt: app.get(JwtService),
    crypto: app.get(KycCryptoService),
    audit: app.get(AuditService),
    media,
  };
}
