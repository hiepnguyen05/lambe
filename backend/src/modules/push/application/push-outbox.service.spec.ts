/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { PushOutboxService } from './push-outbox.service';
import { PrismaService } from '../../../infrastructure/persistence/postgres/prisma.service';
import { FirebaseIdentityService } from '../../../infrastructure/firebase/firebase-identity.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  currentRequestId,
  runWithRequestId,
} from '../../../common/http/request-context';
import { ObservabilityMetrics } from '../../../infrastructure/observability/observability-metrics.service';
import type { Prisma } from '@prisma/client';

const send = jest.fn();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send }),
}));

describe('PushOutboxService', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  const row = {
    id: 'outbox-id',
    userId: 'user-id',
    deviceId: 'device-id',
    attempts: 1,
    lockedUntil: new Date(),
    sentAt: null,
    failedAt: null,
    event: 'ORDER_REQUESTED',
    entityType: 'ORDER',
    entityId: 'order-id',
    recipientRole: 'PROVIDER',
  };

  function setup(attempts = 1) {
    const prisma = {
      serviceOrder: {
        findUnique: jest.fn().mockResolvedValue({
          customerId: 'customer-id',
          status: 'PENDING_PROVIDER',
          providerResponseDeadlineAt: new Date(Date.now() + 60_000),
          assignedMemberId: null,
          provider: {
            userId: row.userId,
            status: 'ACTIVE',
            user: { status: 'ACTIVE' },
          },
        }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ ...row, attempts }])
        .mockResolvedValue([]),
      userPushDevice: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ token: 'fcm-token', sessionId: 'session-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-id' }),
      },
      pushOutbox: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
          fn(prisma),
        ),
    };
    const firebase = { getFirebaseApp: jest.fn().mockResolvedValue({}) };
    const config = { get: jest.fn().mockReturnValue(true) };
    const metrics = new ObservabilityMetrics();
    return {
      prisma,
      config,
      metrics,
      service: new PushOutboxService(
        prisma as unknown as PrismaService,
        firebase as unknown as FirebaseIdentityService,
        config as unknown as ConfigService,
        metrics,
      ),
    };
  }

  beforeEach(() => {
    send.mockReset();
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('drops queued chat pushes after conversation access is revoked', async () => {
    const { service, prisma, metrics } = setup();
    prisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        { ...row, entityType: 'CHAT', entityId: 'chat-id' },
      ])
      .mockResolvedValue([]);
    Object.assign(prisma, {
      chatConversation: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await service.deliverPending();
    expect(send).not.toHaveBeenCalled();
    expect(metrics.snapshot().firebase).toMatchObject({
      successes: 0,
      errors: 0,
    });
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAt: expect.any(Date) }),
      }),
    );
  });

  it('drops a Feed push when the recipient can no longer read the source notice', async () => {
    const { service, prisma } = setup();
    prisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        { ...row, entityType: 'FEED_NOTICE', entityId: 'notice-id' },
      ])
      .mockResolvedValue([]);
    Object.assign(prisma, {
      feedNotice: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await service.deliverPending();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAt: expect.any(Date) }),
      }),
    );
  });

  it('sends a minimal notification and marks it delivered', async () => {
    send.mockResolvedValue('firebase-id');
    const { service, prisma, metrics } = setup();
    await service.deliverPending();
    expect(metrics.snapshot()).toMatchObject({
      push: { sent: 1 },
      firebase: { successes: 1, errors: 0 },
      workers: { push: { runs: 1, errors: 0 } },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'fcm-token',
        data: expect.objectContaining({
          event: 'ORDER_REQUESTED',
          entityType: 'ORDER',
          entityId: 'order-id',
          recipientRole: 'PROVIDER',
          deepLink: '/provider/orders/order-id',
        }),
      }),
    );
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sentAt: expect.any(Date) }),
      }),
    );
  });

  it('revokes a permanently invalid device token', async () => {
    send.mockRejectedValue({
      code: 'messaging/registration-token-not-registered',
    });
    const { service, prisma, metrics } = setup();
    await service.deliverPending();
    expect(metrics.snapshot()).toMatchObject({
      push: { 'token-invalid': 1, sent: 0 },
      firebase: { successes: 0, errors: 1 },
    });
    expect(prisma.userPushDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { failedAt: expect.any(Date), lockedUntil: null },
      }),
    );
  });

  it('retries transient Firebase failures without revoking the device', async () => {
    send.mockRejectedValue({ code: 'messaging/server-unavailable' });
    const { service, prisma, metrics } = setup();
    await service.deliverPending();
    expect(metrics.snapshot()).toMatchObject({
      push: { retry: 1 },
      firebase: { errors: 1 },
    });
    expect(prisma.userPushDevice.updateMany).not.toHaveBeenCalled();
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedAt: null,
          availableAt: expect.any(Date),
        }),
      }),
    );
  });

  it('stops after eight failed deliveries', async () => {
    send.mockRejectedValue({ code: 'messaging/server-unavailable' });
    const { service, prisma, metrics } = setup(8);
    await service.deliverPending();
    expect(metrics.snapshot().push.failed).toBe(1);
    expect(prisma.pushOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedAt: expect.any(Date),
          lockedUntil: null,
        }),
      }),
    );
  });

  it('records empty-poll heartbeat in an isolated run context without flooding logs', async () => {
    const { service, prisma, metrics } = setup();
    prisma.$queryRaw.mockReset().mockImplementation(async () => {
      await Promise.resolve();
      expect(currentRequestId()).toMatch(/^[0-9a-f-]{36}$/);
      return [];
    });
    await runWithRequestId('api-parent', async () => {
      await service.deliverPending();
      expect(currentRequestId()).toBe('api-parent');
    });
    expect(metrics.snapshot().workers.push).toMatchObject({
      runs: 1,
      errors: 0,
    });
    expect(log).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not report successful outcomes when persistence fails after an actual send', async () => {
    const { service, prisma, metrics } = setup();
    send.mockResolvedValue('firebase-id');
    prisma.pushOutbox.updateMany.mockRejectedValue(
      new Error('private-token@example.test'),
    );
    await service.deliverPending();
    expect(metrics.snapshot()).toMatchObject({
      push: { sent: 0, retry: 0, failed: 0 },
      firebase: { successes: 1, errors: 0 },
      workers: { push: { errors: 1 } },
    });
    expect(metrics.snapshot().events.push['delivery-error']).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'push.poll',
        counts: expect.objectContaining({ errors: 1 }),
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-token');
  });

  it('does not count disabled polls or enqueue attempts that roll back', async () => {
    const { service, config, metrics } = setup();
    const before = metrics.snapshot().events.push;
    config.get.mockReturnValue(false);
    await service.deliverPending();
    expect(metrics.snapshot().workers.push.runs).toBe(0);
    const tx = {
      userPushDevice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'device-id' }]),
      },
      pushOutbox: {
        createMany: jest.fn().mockRejectedValue(new Error('rollback')),
      },
    };
    await expect(
      service.enqueue(tx as unknown as Prisma.TransactionClient, {
        userId: 'user-id',
        sourceId: 'source-id',
        event: 'ORDER_REQUESTED',
        entityType: 'ORDER',
        entityId: 'order-id',
        recipientRole: 'PROVIDER',
      }),
    ).rejects.toThrow('rollback');
    expect(metrics.snapshot().events.push).toEqual(before);
  });

  it('records claim failures as worker errors without inventing a delivery or Firebase result', async () => {
    const { service, prisma, metrics } = setup();
    prisma.$queryRaw
      .mockReset()
      .mockRejectedValue(new Error('private-database-error'));
    await service.deliverPending();
    expect(metrics.snapshot().workers.push).toMatchObject({
      runs: 1,
      errors: 1,
    });
    expect(metrics.snapshot().events.push['delivery-error']).toBe(0);
    expect(metrics.snapshot().firebase).toMatchObject({
      successes: 0,
      errors: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'private-database-error',
    );
  });
});
