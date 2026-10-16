import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import {
  minutes,
  seconds,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import appConfig from './config/app.config';
import cacheConfig from './config/cache.config';
import cloudinaryConfig from './config/cloudinary.config';
import firebaseConfig from './config/firebase.config';
import internalAuthConfig from './config/internal-auth.config';
import kycConfig from './config/kyc.config';
import mailConfig from './config/mail.config';
import momoConfig from './config/momo.config';
import providerConfig from './config/provider.config';
import securityConfig from './config/security.config';
import sepayConfig from './config/sepay.config';
import { validateEnvironment } from './config/env.validation';

import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChatModule } from './modules/chat/chat.module';
import { CustomerOnboardingModule } from './modules/customer-onboarding/customer-onboarding.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { HealthModule } from './modules/health/health.module';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProviderApplicationsModule } from './modules/provider-applications/provider-applications.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ServicesModule } from './modules/services/services.module';
import { UploadModule } from './modules/upload/upload.module';
import { MaintenanceModule } from './infrastructure/maintenance/maintenance.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { RedisThrottlerStorage } from './infrastructure/cache/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        cacheConfig,
        cloudinaryConfig,
        firebaseConfig,
        internalAuthConfig,
        kycConfig,
        mailConfig,
        momoConfig,
        providerConfig,
        securityConfig,
        sepayConfig,
      ],
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [CacheModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            name: 'short',
            ttl: seconds(1),
            limit: 10,
            skipIf: () => process.env.NODE_ENV === 'test',
          },
          {
            name: 'medium',
            ttl: minutes(1),
            limit: 120,
            skipIf: () => process.env.NODE_ENV === 'test',
          },
        ],
      }),
    }),
    AuthModule,
    InternalAuthModule,
    CategoriesModule,
    ChatModule,
    ServicesModule,
    CustomerOnboardingModule,
    CustomersModule,
    ProviderApplicationsModule,
    ProvidersModule,
    DiscoveryModule,
    OrdersModule,
    WalletModule,
    HealthModule,
    MaintenanceModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
