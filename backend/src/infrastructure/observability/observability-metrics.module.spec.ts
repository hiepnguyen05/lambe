import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ObservabilityMetricsModule } from './observability-metrics.module';
import { ObservabilityMetrics } from './observability-metrics.service';

@Injectable()
class WorkerConsumer {
  constructor(readonly metrics: ObservabilityMetrics) {}
}

@Module({ imports: [ObservabilityMetricsModule], providers: [WorkerConsumer] })
class WorkerModule {}

describe('ObservabilityMetricsModule', () => {
  it('is a dependency-free shared singleton for business modules', async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityMetricsModule, WorkerModule],
    }).compile();
    try {
      const metrics = module.get(ObservabilityMetrics);
      expect(module.get(WorkerConsumer).metrics).toBe(metrics);
      module.get(WorkerConsumer).metrics.recordEvent('push', 'retry');
      expect(metrics.snapshot().push.retry).toBe(1);
    } finally {
      await module.close();
    }
  });
});
