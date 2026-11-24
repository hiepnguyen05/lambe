import { Module } from '@nestjs/common';
import { ObservabilityMetricsModule } from '../../infrastructure/observability/observability-metrics.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../../infrastructure/firebase/firebase.module';
import { PushDevicesService } from './application/push-devices.service';
import { PushOutboxService } from './application/push-outbox.service';
import { OrderPushRelayService } from './application/order-push-relay.service';
import { PushDevicesController } from './controllers/push-devices.controller';

@Module({
  imports: [
    AuthModule,
    PostgresModule,
    FirebaseModule,
    ObservabilityMetricsModule,
  ],
  controllers: [PushDevicesController],
  providers: [PushDevicesService, PushOutboxService, OrderPushRelayService],
  exports: [PushOutboxService],
})
export class PushModule {}
