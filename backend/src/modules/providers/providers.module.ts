import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ProviderSetupController } from './controllers/provider-setup.controller';
import { ProviderSetupService } from './application/provider-setup.service';

@Module({
  imports: [PostgresModule, AuditModule, AuthModule],
  controllers: [ProviderSetupController],
  providers: [ProviderSetupService],
})
export class ProvidersModule {}
