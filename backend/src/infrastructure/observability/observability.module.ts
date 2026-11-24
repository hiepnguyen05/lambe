import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { InternalAuthModule } from '../../modules/internal-auth/internal-auth.module';
import { CacheModule } from '../cache/cache.module';
import { PostgresModule } from '../persistence/postgres/postgres.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityMetricsModule } from './observability-metrics.module';
import { ObservabilityMiddleware } from './observability.middleware';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [
    InternalAuthModule,
    CacheModule,
    PostgresModule,
    ObservabilityMetricsModule,
  ],
  controllers: [ObservabilityController],
  providers: [ObservabilityService, ObservabilityMiddleware],
  exports: [ObservabilityMetricsModule],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ObservabilityMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
