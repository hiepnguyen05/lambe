import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { UserTokenService } from '../src/modules/auth/application/user-token.service';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Push device ownership and logout (e2e)', () => {
  let context: TestAppContext;
  let tokens: UserTokenService;
  const userIds: string[] = [];

  async function account() {
    const user = await context.prisma.user.create({
      data: {
        phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
        firebaseUid: `push-e2e-${randomUUID()}`,
      },
    });
    userIds.push(user.id);
    const sessionId = randomUUID();
    const refreshToken = tokens.createRefreshToken(sessionId);
    await context.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return {
      userId: user.id,
      sessionId,
      accessToken: tokens.generateAccessToken(user.id, user.phone, sessionId),
      refreshToken,
    };
  }

  beforeAll(async () => {
    context = await createTestApp();
    tokens = context.app.get(UserTokenService);
  });

  afterAll(async () => {
    if (!context) return;
    await context.prisma.userPushDevice.deleteMany({
      where: { userId: { in: userIds } },
    });
    await context.prisma.userSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await context.prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    await context.app.close();
  });

  it('transfers one FCM token, hides it in response and denies another user revocation', async () => {
    const first = await account();
    const second = await account();
    const device = {
      platform: 'ANDROID',
      deviceId: randomUUID(),
      token: `fcm-${randomUUID()}-${randomUUID()}`,
      appVersion: '1.0.0',
    };

    const initial = await request(context.app.getHttpServer())
      .put('/api/me/push-devices')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send(device)
      .expect(200);
    const initialId = (initial.body as { data: { id: string } }).data.id;
    expect(JSON.stringify(initial.body)).not.toContain(device.token);

    const again = await request(context.app.getHttpServer())
      .put('/api/me/push-devices')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send(device)
      .expect(200);
    expect((again.body as { data: { id: string } }).data.id).toBe(initialId);

    const transferred = await request(context.app.getHttpServer())
      .put('/api/me/push-devices')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send(device)
      .expect(200);
    expect((transferred.body as { data: { id: string } }).data.id).toBe(
      initialId,
    );
    const stored = await context.prisma.userPushDevice.findUniqueOrThrow({
      where: { id: initialId },
    });
    expect(stored.userId).toBe(second.userId);
    expect(stored.sessionId).toBe(second.sessionId);

    await request(context.app.getHttpServer())
      .delete(`/api/me/push-devices/${stored.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(404);

    await request(context.app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(
      (
        await context.prisma.userPushDevice.findUniqueOrThrow({
          where: { id: stored.id },
        })
      ).revokedAt,
    ).toBeNull();

    await request(context.app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: second.refreshToken })
      .expect(200);
    expect(
      (
        await context.prisma.userPushDevice.findUniqueOrThrow({
          where: { id: stored.id },
        })
      ).revokedAt,
    ).not.toBeNull();
  });

  it('revokes the previous token when Firebase rotates it on one installation', async () => {
    const owner = await account();
    const deviceId = randomUUID();
    const registration = {
      platform: 'ANDROID',
      deviceId,
      token: `fcm-${randomUUID()}-${randomUUID()}`,
    };
    const first = await request(context.app.getHttpServer())
      .put('/api/me/push-devices')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(registration)
      .expect(200);
    const firstId = (first.body as { data: { id: string } }).data.id;
    const second = await request(context.app.getHttpServer())
      .put('/api/me/push-devices')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ ...registration, token: `fcm-${randomUUID()}-${randomUUID()}` })
      .expect(200);
    expect((second.body as { data: { id: string } }).data.id).not.toBe(firstId);
    expect(
      (
        await context.prisma.userPushDevice.findUniqueOrThrow({
          where: { id: firstId },
        })
      ).revokedAt,
    ).not.toBeNull();
  });
});
