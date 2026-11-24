import { Module } from '@nestjs/common';
import { ObservabilityMetrics } from './observability-metrics.service';

// Leaf dependency: workers/business modules import this, never the dashboard module.
@Module({
  providers: [ObservabilityMetrics],
  exports: [ObservabilityMetrics],
})
export class ObservabilityMetricsModule {}
