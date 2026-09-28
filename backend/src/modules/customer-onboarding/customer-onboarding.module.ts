import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/persistence/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { CustomerOnboardingService } from './application/customer-onboarding.service';
import { CustomerRecommendationsService } from './application/customer-recommendations.service';
import { CustomerOnboardingController } from './controllers/customer-onboarding.controller';
import { CustomerRecommendationsController } from './controllers/customer-recommendations.controller';
import { OnboardingOptionsController } from './controllers/onboarding-options.controller';

@Module({
  imports: [PostgresModule, AuthModule],
  controllers: [
    CustomerOnboardingController,
    OnboardingOptionsController,
    CustomerRecommendationsController,
  ],
  providers: [CustomerOnboardingService, CustomerRecommendationsService],
})
export class CustomerOnboardingModule {}
