import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { AdminProviderManagementService } from './application/management/admin-provider-management.service';
import { ProviderSetupController } from './controllers/provider-setup.controller';
import { ProviderSetupService } from './application/provider-setup.service';
import { ProviderAvailabilityController } from './controllers/provider-availability.controller';
import { ProviderAvailabilityService } from './application/availability/provider-availability.service';
import { AdminProvidersController } from './controllers/admin-providers.controller';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    CacheModule,
    AuthModule,
    InternalAuthModule,
  ],
  controllers: [
    ProviderSetupController,
    ProviderAvailabilityController,
    AdminProvidersController,
  ],
  providers: [
    ProviderSetupService,
    ProviderAvailabilityService,
    AdminProviderManagementService,
  ],
})
export class ProvidersModule {}
