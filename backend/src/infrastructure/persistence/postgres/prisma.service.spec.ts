import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    jest.restoreAllMocks();
  });

  it('connects during module initialization and logs the database target', async () => {
    process.env.DB_HOST = 'db.local';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'lambe_test';
    const service = new PrismaService();
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(connectSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Database connected successfully: lambe_test at db.local:5433',
    );
  });

  it('logs and rethrows a database connection failure', async () => {
    const service = new PrismaService();
    const connectionError = new Error('connection refused');
    jest.spyOn(service, '$connect').mockRejectedValue(connectionError);
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.onModuleInit()).rejects.toBe(connectionError);
    expect(errorSpy).toHaveBeenCalledWith(
      'Database connection failed: connection refused',
    );
  });

  it('disconnects during module destruction', async () => {
    const service = new PrismaService();
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
