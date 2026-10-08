import { Module } from '@nestjs/common';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { ProviderDiscoveryService } from './application/provider-discovery.service';
import { ProviderDiscoveryController } from './controllers/provider-discovery.controller';

@Module({
  imports: [PostgresModule, CacheModule, AuthModule],
  controllers: [ProviderDiscoveryController],
  providers: [ProviderDiscoveryService],
})
export class DiscoveryModule {}
