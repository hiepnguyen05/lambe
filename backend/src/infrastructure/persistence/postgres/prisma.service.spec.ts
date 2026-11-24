import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgresModule } from './postgres.module';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves through Nest and connects during module initialization', async () => {
    const module = await Test.createTestingModule({
      imports: [PostgresModule],
    }).compile();
    const service = module.get(PrismaService);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
    jest.spyOn(service, '$disconnect').mockResolvedValue();

    try {
      await module.init();
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith({ event: 'postgres.connected' });
    } finally {
      await module.close();
    }
  });

  it('logs and rethrows a database connection failure', async () => {
    const service = new PrismaService();
    const connectionError = new Error('postgresql://owner:secret@private/db');
    jest.spyOn(service, '$connect').mockRejectedValue(connectionError);
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(service.onModuleInit()).rejects.toBe(connectionError);
    expect(errorSpy.mock.calls).toEqual([
      [{ event: 'postgres.connection_failed' }],
    ]);
  });

  it('disconnects during module destruction', async () => {
    const service = new PrismaService();
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('accepts an isolated datasource override for integration tests', async () => {
    const service = new PrismaService({
      datasources: {
        db: {
          url: 'postgresql://test:test@127.0.0.1:5432/lambe_booking_test_unit',
        },
      },
      transactionOptions: { timeout: 1_000 },
    });
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
