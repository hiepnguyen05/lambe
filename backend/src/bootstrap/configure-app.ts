import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from '../common/http/interceptors/transform.interceptor';
import { requestIdMiddleware } from '../common/http/middleware/request-id.middleware';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const configuredOrigins =
    configService
      .get<string>('app.corsOrigin')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  const trustProxy = configService.get<false | number | string>(
    'app.trustProxy',
    false,
  );

  if (trustProxy !== false && app.getHttpAdapter().getType() === 'express') {
    const express = app.getHttpAdapter().getInstance() as {
      set(name: string, value: number | string): void;
    };
    express.set('trust proxy', trustProxy);
  }

  app.setGlobalPrefix('api');
  app.use(requestIdMiddleware);
  app.enableCors({
    origin: nodeEnv === 'production' ? configuredOrigins : true,
    credentials: true,
  });
  app.enableShutdownHooks();
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configure Swagger OpenAPI Docs (enabled in dev/staging, skipped in test suites and production)
  if (nodeEnv !== 'production' && process.env.NODE_ENV !== 'test') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Lambe Beauty Booking API')
      .setDescription(
        'Hệ thống API backend cho dịch vụ đặt lịch làm đẹp Lambe. Hỗ trợ OTP SMS, Admin Authentication, Danh mục dịch vụ, Upload Cloudinary.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'user-token',
      )
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'internal-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }
}
