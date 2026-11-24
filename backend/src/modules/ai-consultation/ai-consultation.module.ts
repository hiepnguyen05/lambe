import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { ObservabilityMetricsModule } from '../../infrastructure/observability/observability-metrics.module';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { AiConsultationController } from './controllers/ai-consultation.controller';
import { AiConsultationService } from './application/ai-consultation.service';
import { AiRecommendationsService } from './application/ai-recommendations.service';
import { GeminiConsultationService } from './infrastructure/gemini-consultation.service';
import { AiRecommendationRefreshService } from './application/ai-recommendation-refresh.service';
import { AiMessageProcessingService } from './application/ai-message-processing.service';
import { AiFeedbackService } from './application/ai-feedback.service';

@Module({
  imports: [
    UploadModule,
    PostgresModule,
    AuthModule,
    DiscoveryModule,
    ObservabilityMetricsModule,
  ],
  controllers: [AiConsultationController],
  providers: [
    AiConsultationService,
    AiMessageProcessingService,
    AiFeedbackService,
    AiRecommendationsService,
    GeminiConsultationService,
    AiRecommendationRefreshService,
  ],
})
export class AiConsultationModule {}
