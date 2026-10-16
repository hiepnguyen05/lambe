import { Module } from '@nestjs/common';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { ScheduledProviderCandidatesService } from './application/scheduled-provider-candidates.service';
import { ProviderDiscoveryService } from './application/provider-discovery.service';
import { ProviderDiscoveryController } from './controllers/provider-discovery.controller';

@Module({
  imports: [PostgresModule, CacheModule, AuthModule, OrdersModule],
  controllers: [ProviderDiscoveryController],
  providers: [ProviderDiscoveryService, ScheduledProviderCandidatesService],
})
export class DiscoveryModule {}
