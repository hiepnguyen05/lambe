/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { Logger } from '@nestjs/common';
import { currentRequestId } from '../../../../common/http/request-context';
import { ObservabilityMetrics } from '../../../../infrastructure/observability/observability-metrics.service';
import { OrderNotificationRelayService } from './order-notification-relay.service';

describe('OrderNotificationRelayService observability', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  function setup() {
    const prisma = {
      orderNotification: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const cache = {
      getStatus: jest.fn().mockReturnValue('up'),
      publishOrderNotification: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = new ObservabilityMetrics();
    const service = new OrderNotificationRelayService(
      prisma as never,
      cache as never,
      metrics,
    );
    return { service, prisma, cache, metrics };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('records empty polls and committed publications with an ephemeral context', async () => {
    const { service, prisma, metrics } = setup();
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(metrics.snapshot().workers['order-notice-relay']).toMatchObject({
      runs: 1,
      errors: 0,
    });
    prisma.orderNotification.findMany.mockImplementation(async () => {
      await Promise.resolve();
      expect(currentRequestId()).toMatch(/^[0-9a-f-]{36}$/);
      return [{ id: 'private-notice', userId: 'private-user' }];
    });
    await jest.advanceTimersByTimeAsync(1000);
    service.onModuleDestroy();
    expect(metrics.snapshot().workers['order-notice-relay']).toMatchObject({
      runs: 2,
      errors: 0,
    });
    expect(log).toHaveBeenLastCalledWith({
      event: 'order-notice-relay.poll',
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      counts: { published: 1, errors: 0 },
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private-notice|private-user/,
    );
    expect(currentRequestId()).toBeUndefined();
  });

  it('sanitizes failed publication summaries and records worker errors', async () => {
    const { service, prisma, cache, metrics } = setup();
    prisma.orderNotification.findMany.mockResolvedValue([
      { id: 'private-notice', userId: 'private-user' },
    ]);
    cache.publishOrderNotification.mockRejectedValue(
      new Error('redis://private-token'),
    );
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    service.onModuleDestroy();
    expect(prisma.orderNotification.updateMany).not.toHaveBeenCalled();
    expect(metrics.snapshot().workers['order-notice-relay']).toMatchObject({
      runs: 1,
      errors: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'order-notice-relay.poll',
        counts: { published: 0, errors: 1 },
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /private-notice|private-user|private-token/,
    );
  });

  it('does not heartbeat when Redis is disabled/down or count an uncommitted publication', async () => {
    const { service, prisma, cache, metrics } = setup();
    cache.getStatus.mockReturnValue('down');
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(metrics.snapshot().workers['order-notice-relay'].runs).toBe(0);
    cache.getStatus.mockReturnValue('up');
    prisma.orderNotification.findMany.mockResolvedValue([
      { id: 'private-notice', userId: 'private-user' },
    ]);
    prisma.orderNotification.updateMany.mockRejectedValue(
      new Error('private-db-error'),
    );
    await jest.advanceTimersByTimeAsync(1000);
    service.onModuleDestroy();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ counts: { published: 0, errors: 1 } }),
    );
  });
});
