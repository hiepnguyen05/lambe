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
import internalAuthConfig from './config/internal-auth.config';
import securityConfig from './config/security.config';
import speedSmsConfig from './config/speedsms.config';
import { validateEnvironment } from './config/env.validation';

import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { MaintenanceModule } from './infrastructure/maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        cacheConfig,
        cloudinaryConfig,
        internalAuthConfig,
        securityConfig,
        speedSmsConfig,
      ],
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
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
    ]),
    AuthModule,
    InternalAuthModule,
    CategoriesModule,
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
