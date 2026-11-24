import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { UserTokenService } from '../src/modules/auth/application/user-token.service';
import { createTestApp, type TestAppContext } from './support/create-test-app';

describe('Chat SSE authorization and reconnect (e2e)', () => {
  let context: TestAppContext;
  let baseUrl: string;
  let conversationId: string;
  let customerToken: string;
  let providerToken: string;
  let outsiderToken: string;
  const createdUserIds: string[] = [];
  let providerProfileId: string;
  let applicationId: string;

  async function createUser() {
    const user = await context.prisma.user.create({
      data: {
        phone: `039${randomInt(0, 10_000_000).toString().padStart(7, '0')}`,
        firebaseUid: `chat-e2e-${randomUUID()}`,
      },
    });
    createdUserIds.push(user.id);
    const session = await context.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const token = context.app
      .get(UserTokenService)
      .generateAccessToken(user.id, user.phone, session.id);
    return { user, token };
  }

  beforeAll(async () => {
    context = await createTestApp();
    await context.app.listen(0, '127.0.0.1');
    baseUrl = await context.app.getUrl();
    const customer = await createUser();
    const provider = await createUser();
    const outsider = await createUser();
    customerToken = customer.token;
    providerToken = provider.token;
    outsiderToken = outsider.token;
    const application = await context.prisma.providerApplication.create({
      data: {
        userId: provider.user.id,
        providerType: 'INDIVIDUAL',
        status: 'APPROVED',
      },
    });
    applicationId = application.id;
    const profile = await context.prisma.providerProfile.create({
      data: {
        userId: provider.user.id,
        sourceApplicationId: application.id,
        providerType: 'INDIVIDUAL',
        displayName: 'Chat SSE Test Provider',
        status: 'ACTIVE',
      },
    });
    providerProfileId = profile.id;
    const conversation = await context.prisma.chatConversation.create({
      data: {
        customerId: customer.user.id,
        providerId: profile.id,
        lastSequence: 1,
        messages: {
          create: {
            sequence: 1,
            senderUserId: customer.user.id,
            kind: 'TEXT',
            text: 'Tin đầu tiên',
          },
        },
        participants: {
          create: [
            { userId: customer.user.id, lastReadSequence: 1 },
            { userId: provider.user.id },
          ],
        },
      },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    if (!context) return;
    await context.prisma.chatMessage.deleteMany({ where: { conversationId } });
    await context.prisma.chatParticipantState.deleteMany({
      where: { conversationId },
    });
    await context.prisma.chatConversation.delete({
      where: { id: conversationId },
    });
    await context.prisma.providerProfile.delete({
      where: { id: providerProfileId },
    });
    await context.prisma.providerApplication.delete({
      where: { id: applicationId },
    });
    await context.prisma.userSession.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await context.prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await context.app.close();
  });

  it('returns 404 to an account outside the conversation', async () => {
    await request(context.app.getHttpServer())
      .get(`/api/me/conversations/${conversationId}/events`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('delivers a committed message and replays it after reconnect', async () => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10_000);
    try {
      const stream = await fetch(
        `${baseUrl}/api/me/conversations/${conversationId}/events?afterSequence=1`,
        {
          headers: { Authorization: `Bearer ${customerToken}` },
          signal: abort.signal,
        },
      );
      expect(stream.status).toBe(200);
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      const reader = stream.body!.getReader();
      await request(context.app.getHttpServer())
        .post(`/api/me/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          kind: 'TEXT',
          text: 'Tin mới từ thợ',
          clientMessageId: randomUUID(),
        })
        .expect(200);
      const chunk = new TextDecoder().decode((await reader.read()).value);
      expect(chunk).toContain('id: 2\nevent: message');
      expect(chunk).toContain('Tin mới từ thợ');
    } finally {
      clearTimeout(timeout);
      abort.abort();
    }

    const reconnect = new AbortController();
    const reconnectTimeout = setTimeout(() => reconnect.abort(), 10_000);
    try {
      const stream = await fetch(
        `${baseUrl}/api/me/conversations/${conversationId}/events?afterSequence=1`,
        {
          headers: { Authorization: `Bearer ${customerToken}` },
          signal: reconnect.signal,
        },
      );
      expect(stream.status).toBe(200);
      const chunk = new TextDecoder().decode(
        (await stream.body!.getReader().read()).value,
      );
      expect(chunk).toContain('id: 2\nevent: message');
    } finally {
      clearTimeout(reconnectTimeout);
      reconnect.abort();
    }
  }, 25_000);
});
