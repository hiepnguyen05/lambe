import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const configuredOrigins =
    configService
      .get<string>('app.corsOrigin')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: nodeEnv === 'production' ? configuredOrigins : true,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
