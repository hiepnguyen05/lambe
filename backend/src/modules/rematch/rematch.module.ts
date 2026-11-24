import { Module } from '@nestjs/common';
import { ObservabilityMetricsModule } from '../../infrastructure/observability/observability-metrics.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { OrdersModule } from '../orders/orders.module';
import { RematchService } from './application/rematch.service';
import { RematchController } from './controllers/rematch.controller';

@Module({
  imports: [
    PostgresModule,
    AuthModule,
    DiscoveryModule,
    OrdersModule,
    ObservabilityMetricsModule,
  ],
  controllers: [RematchController],
  providers: [RematchService],
})
export class RematchModule {}
