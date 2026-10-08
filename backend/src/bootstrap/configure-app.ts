import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
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
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
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

  if (nodeEnv === 'development' && process.env.NODE_ENV !== 'test') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Lambe Beauty Booking API')
      .setDescription(
        [
          'Tài liệu API backend cho Lambe, nền tảng kết nối khách hàng với nhà cung cấp dịch vụ làm đẹp tại nhà.',
          'Các nhóm API chính: Firebase user authentication, internal admin authentication, customer profile/onboarding/address, service categories, services, provider applications, provider setup, provider availability, provider discovery, upload và health check.',
          'Response thành công được bọc theo chuẩn { statusCode, success, data, meta?, timestamp }. User token và internal token dùng hai nút Authorize riêng trong Swagger.',
        ].join('\n\n'),
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
