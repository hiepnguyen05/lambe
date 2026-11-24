import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { ProviderNotificationsService } from './application/provider-notifications.service';
import { ProviderNotificationRelayService } from './application/provider-notification-relay.service';
import { ProviderNotificationSignalsService } from './application/provider-notification-signals.service';
import { ProviderNotificationsController } from './controllers/provider-notifications.controller';

@Module({
  imports: [PostgresModule, CacheModule, AuthModule, PushModule],
  controllers: [ProviderNotificationsController],
  providers: [
    ProviderNotificationsService,
    ProviderNotificationRelayService,
    ProviderNotificationSignalsService,
  ],
})
export class ProviderNotificationsModule {}
