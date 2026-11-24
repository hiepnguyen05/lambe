import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infrastructure/persistence/postgres/prisma.service';
import { requireIsolatedTestDatabase } from './support/isolated-test-database';
import { FirebaseIdentityService } from '../src/infrastructure/firebase/firebase-identity.service';
import { ProviderApplicationNotificationService } from '../src/modules/provider-applications/application/notifications/provider-application-notification.service';
import { PushOutboxService } from '../src/modules/push/application/push-outbox.service';

const send = jest.fn();
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send }),
}));

describe('push outbox PostgreSQL claim', () => {
  jest.setTimeout(30_000);
  let prisma: PrismaService;
  let userId: string;
  let rowId: string;
  const applicationIds: string[] = [];

  beforeAll(async () => {
    requireIsolatedTestDatabase(process.env);
    const url = process.env.TEST_DATABASE_URL;
    prisma = new PrismaService({ datasources: { db: { url } } });
    await prisma.$connect();
    userId = randomUUID();
    const sessionId = randomUUID();
    const deviceId = randomUUID();
    const token = `test-fcm-${randomUUID()}`;
    await prisma.user.create({
      data: {
        id: userId,
        phone: `+84${Math.floor(100000000 + Math.random() * 900000000)}`,
      },
    });
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.userPushDevice.create({
      data: {
        id: deviceId,
        userId,
        sessionId,
        platform: 'ANDROID',
        deviceId: randomUUID(),
        token,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });
    const application = await prisma.providerApplication.create({
      data: { userId, providerType: 'INDIVIDUAL' },
    });
    applicationIds.push(application.id);
    const row = await prisma.pushOutbox.create({
      data: {
        userId,
        deviceId,
        deduplicationKey: `test:${randomUUID()}`,
        event: 'APPLICATION_SUBMITTED',
        entityType: 'APPLICATION',
        entityId: application.id,
        recipientRole: 'CUSTOMER',
      },
    });
    rowId = row.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (applicationIds.length) {
        await prisma.providerApplication.deleteMany({
          where: { id: { in: applicationIds } },
        });
      }
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });

  it('lets only one of two workers claim and send the row', async () => {
    send.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'dry-run-id';
    });
    const firebase = { getFirebaseApp: jest.fn().mockResolvedValue({}) };
    const config = { get: jest.fn().mockReturnValue(true) };
    const first = new PushOutboxService(
      prisma,
      firebase as unknown as FirebaseIdentityService,
      config as unknown as ConfigService,
    );
    const second = new PushOutboxService(
      prisma,
      firebase as unknown as FirebaseIdentityService,
      config as unknown as ConfigService,
    );

    await Promise.all([first.deliverPending(), second.deliverPending()]);

    const stored = await prisma.pushOutbox.findUniqueOrThrow({
      where: { id: rowId },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(stored.attempts).toBe(1);
    expect(stored.sentAt).not.toBeNull();
  });

  it('keeps a committed application and its notification when Firebase is unavailable', async () => {
    send.mockReset();
    send.mockRejectedValue({ code: 'messaging/server-unavailable' });
    const application = await prisma.providerApplication.findUniqueOrThrow({
      where: { id: applicationIds[0] },
    });
    const firebase = { getFirebaseApp: jest.fn().mockResolvedValue({}) };
    const config = { get: jest.fn().mockReturnValue(true) };
    const push = new PushOutboxService(
      prisma,
      firebase as unknown as FirebaseIdentityService,
      config as unknown as ConfigService,
    );
    const notification = new ProviderApplicationNotificationService(
      { enqueue: jest.fn() } as never,
      push,
    );
    await prisma.$transaction(async (tx) => {
      await tx.providerApplication.update({
        where: { id: application.id },
        data: { status: 'PENDING_REVIEW', revisionNumber: 1 },
      });
      await notification.notifySubmitted(
        {
          applicationId: application.id,
          userId,
          email: null,
          displayName: null,
          revisionNumber: 1,
        },
        tx,
      );
    });
    await push.deliverPending();
    const [storedApplication, outbox] = await Promise.all([
      prisma.providerApplication.findUniqueOrThrow({
        where: { id: application.id },
      }),
      prisma.pushOutbox.findFirstOrThrow({
        where: {
          entityType: 'APPLICATION',
          entityId: application.id,
          sourceId: { not: null },
        },
      }),
    ]);
    expect(storedApplication.status).toBe('PENDING_REVIEW');
    expect(outbox.attempts).toBe(1);
    expect(outbox.sentAt).toBeNull();
    expect(outbox.failedAt).toBeNull();
    expect(outbox.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('discards a queued chat push when the recipient no longer has conversation access', async () => {
    send.mockReset();
    const original = await prisma.pushOutbox.findUniqueOrThrow({
      where: { id: rowId },
    });
    const row = await prisma.pushOutbox.create({
      data: {
        userId,
        deviceId: original.deviceId,
        deduplicationKey: `test:${randomUUID()}`,
        event: 'CHAT_MESSAGE',
        entityType: 'CHAT',
        entityId: randomUUID(),
        recipientRole: 'CUSTOMER',
      },
    });
    const push = new PushOutboxService(
      prisma,
      {
        getFirebaseApp: jest.fn().mockResolvedValue({}),
      } as unknown as FirebaseIdentityService,
      new ConfigService({ firebase: { enabled: true } }),
    );
    await push.deliverPending();
    const stored = await prisma.pushOutbox.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(send).not.toHaveBeenCalled();
    expect(stored.attempts).toBe(1);
    expect(stored.failedAt).not.toBeNull();
    expect(stored.sentAt).toBeNull();
  });
});
