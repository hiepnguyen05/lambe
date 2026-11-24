import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { recoveryOrder } from './support/quality-recovery.fixture';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';

const container = 'lambe-quality-redis';
const restartSuite =
  process.env.QUALITY_REDIS_RESTART_TEST === '1' ? describe : describe.skip;
const docker = (...args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 20_000 });

async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Redis recovery condition timed out.');
}

restartSuite('Redis outage recovery — dedicated disposable Redis only', () => {
  let c: Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
  beforeAll(async () => {
    if (
      process.env.REDIS_URL !== 'redis://127.0.0.1:6381/15' ||
      process.env.TEST_REDIS_URL !== process.env.REDIS_URL ||
      process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL ||
      docker(
        'inspect',
        '--format',
        '{{index .Config.Labels "lambe.task"}}',
        container,
      ).trim() !== 'quality-20261030'
    ) {
      throw new Error(
        'Restart test requires the dedicated labeled Redis container and isolated test database.',
      );
    }
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
  });
  afterAll(async () => {
    if (c) await c.app.close();
  });

  it('persists chat during outage, reconnects the existing client and resumes pub/sub without restarting Nest', async () => {
    const customer = await memberTestUser(c.prisma, c.jwt);
    const { provider } = await memberTestOrganization(c.prisma, c.jwt, true);
    const order = await recoveryOrder(c.prisma, provider, customer.id);
    let noticeId: string | undefined;
    const started = await request(c.app.getHttpServer())
      .post('/api/me/conversations')
      .auth(customer.token, { type: 'bearer' })
      .send({
        providerId: provider.id,
        clientMessageId: randomUUID(),
        text: 'Tin đầu tiên',
      })
      .expect(200);
    const conversationId = (
      started.body as { data: { conversationId: string } }
    ).data.conversationId;
    const wake = jest.fn();
    const unsubscribe = await c.cache.subscribeChatUpdates(
      conversationId,
      wake,
    );
    let cold: RedisCacheService | undefined;
    try {
      docker('stop', '--time', '1', container);
      await until(() => c.cache.getStatus() === 'down');
      cold = new RedisCacheService(
        new ConfigService({
          cache: {
            enabled: true,
            url: process.env.REDIS_URL,
            connectTimeoutMs: 150,
          },
        }),
      );
      const startup = Date.now();
      await cold.onModuleInit();
      expect(Date.now() - startup).toBeLessThan(1500);
      expect(cold.getStatus()).toBe('down');
      const notice = await c.prisma.orderNotification.create({
        data: {
          userId: customer.id,
          orderId: order.id,
          event: 'ORDER_ACCEPTED',
        },
      });
      noticeId = notice.id;
      expect(notice.publishedAt).toBeNull();
      await request(c.app.getHttpServer())
        .post(`/api/me/conversations/${conversationId}/messages`)
        .auth(customer.token, { type: 'bearer' })
        .send({
          kind: 'TEXT',
          text: 'Đã lưu khi Redis tạm ngắt',
          clientMessageId: randomUUID(),
        })
        .expect(200);
      const history = await request(c.app.getHttpServer())
        .get(`/api/me/conversations/${conversationId}/messages?afterSequence=1`)
        .auth(customer.token, { type: 'bearer' })
        .expect(200);
      expect(JSON.stringify(history.body)).toContain(
        'Đã lưu khi Redis tạm ngắt',
      );
      expect(
        await c.prisma.chatMessage.count({ where: { conversationId } }),
      ).toBe(2);
    } finally {
      docker('start', container);
    }
    try {
      await until(
        () => c.cache.getStatus() === 'up' && cold?.getStatus() === 'up',
      );
      await until(async () => {
        await c.cache.publishChatUpdate(conversationId);
        return wake.mock.calls.length > 0;
      });
      expect(wake).toHaveBeenCalled();
      await until(async () =>
        Boolean(
          (
            await c.prisma.orderNotification.findUniqueOrThrow({
              where: { id: noticeId },
            })
          ).publishedAt,
        ),
      );
      const notifications = await request(c.app.getHttpServer())
        .get('/api/me/notifications')
        .auth(customer.token, { type: 'bearer' })
        .expect(200);
      expect(JSON.stringify(notifications.body)).toContain(noticeId);
      await c.cache.set('lambe:quality:reconnected', { ok: true }, 5);
      expect(await c.cache.get('lambe:quality:reconnected')).toEqual({
        ok: true,
      });
    } finally {
      await unsubscribe();
      await cold?.onModuleDestroy();
    }
  });
});
