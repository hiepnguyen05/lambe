import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { configureApp } from './configure-app';

describe('configureApp', () => {
  const createApp = (
    nodeEnv?: string,
    corsOrigin?: string,
    trustProxy: false | number | string = false,
  ) => {
    const express = { set: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'app.nodeEnv') return nodeEnv;
        if (key === 'app.corsOrigin') return corsOrigin;
        if (key === 'app.trustProxy') return trustProxy;
        return undefined;
      }),
    };
    const app = {
      get: jest.fn().mockReturnValue(configService),
      setGlobalPrefix: jest.fn(),
      use: jest.fn(),
      enableCors: jest.fn(),
      enableShutdownHooks: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalPipes: jest.fn(),
      getHttpAdapter: jest.fn().mockReturnValue({
        getType: jest.fn().mockReturnValue('express'),
        getInstance: jest.fn().mockReturnValue(express),
      }),
      getModules: jest.fn().mockReturnValue(new Map()),
    };

    configureApp(app as unknown as INestApplication);
    return { app, express };
  };

  it('allows dynamic origins during local development', () => {
    const { app } = createApp('development');

    expect(app.get).toHaveBeenCalledWith(ConfigService);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.use).toHaveBeenCalledWith(expect.any(Function));
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: true,
      credentials: true,
    });
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.useGlobalInterceptors).toHaveBeenCalled();
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
  });

  it('uses a cleaned origin allowlist in production', () => {
    const { app } = createApp(
      'production',
      'https://lambe.vn, https://admin.lambe.vn, ',
    );

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['https://lambe.vn', 'https://admin.lambe.vn'],
      credentials: true,
    });
  });

  it('falls back to development behavior when NODE_ENV is absent', () => {
    const { app } = createApp();

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: true,
      credentials: true,
    });
  });

  it('configures Express trust proxy when explicitly enabled', () => {
    const { express } = createApp('production', 'https://lambe.vn', 1);

    expect(express.set).toHaveBeenCalledWith('trust proxy', 1);
  });
});
