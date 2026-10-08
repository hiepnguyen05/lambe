import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { CustomerAddressesService } from './application/customer-addresses.service';
import { ChangeCustomerStatusService } from './application/management/change-customer-status.service';
import { CustomerManagementQueryService } from './application/management/customer-management-query.service';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { CustomerAddressesController } from './controllers/customer-addresses.controller';

@Module({
  imports: [
    PostgresModule,
    AuditModule,
    CacheModule,
    AuthModule,
    InternalAuthModule,
  ],
  controllers: [CustomerAddressesController, AdminCustomersController],
  providers: [
    CustomerAddressesService,
    CustomerManagementQueryService,
    ChangeCustomerStatusService,
  ],
})
export class CustomersModule {}
