import { Module } from '@nestjs/common';
import { ObservabilityMetricsModule } from '../../observability/observability-metrics.module';
import { ObservabilityMetrics } from '../../observability/observability-metrics.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ObservabilityMetricsModule],
  providers: [
    {
      provide: PrismaService,
      inject: [ObservabilityMetrics],
      useFactory: (metrics: ObservabilityMetrics) =>
        new PrismaService({}, (duration) =>
          metrics.recordPostgresQuery(duration),
        ),
    },
  ],
  exports: [PrismaService],
})
export class PostgresModule {}
