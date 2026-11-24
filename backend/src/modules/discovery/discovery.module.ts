import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { ProviderMembersModule } from '../provider-members/provider-members.module';
import { MemberDiscoveryService } from './application/member-discovery.service';
import { PublicMembersController } from './controllers/public-members.controller';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { ScheduledProviderCandidatesService } from './application/scheduled-provider-candidates.service';
import { ProviderDiscoveryService } from './application/provider-discovery.service';
import { ProviderDiscoveryController } from './controllers/provider-discovery.controller';

@Module({
  imports: [
    UploadModule,
    PostgresModule,
    CacheModule,
    AuthModule,
    OrdersModule,
    ProviderMembersModule,
  ],
  controllers: [ProviderDiscoveryController, PublicMembersController],
  providers: [
    ProviderDiscoveryService,
    ScheduledProviderCandidatesService,
    MemberDiscoveryService,
  ],
  exports: [ProviderDiscoveryService],
})
export class DiscoveryModule {}
