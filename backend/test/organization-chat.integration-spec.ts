import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import { memberCapabilitiesFixture } from './support/member-capabilities.fixture';
import { memberTestUser } from './support/provider-members.fixture';
import { PushOutboxService } from '../src/modules/push/application/push-outbox.service';
import { lockAccessibleChat } from '../src/modules/chat/application/chat.helpers';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
type Worker = Awaited<ReturnType<typeof memberCapabilitiesFixture>>;
type Customer = Awaited<ReturnType<typeof memberTestUser>>;
interface Envelope<T> {
  data: T;
}
interface Message {
  id: string;
  sequence: number;
  text: string | null;
  orderId: string | null;
  attachments: { url: string }[];
}
interface Room {
  id: string;
  context: {
    type: string;
    orderId: string | null;
    readOnly: boolean;
    workerCanChat: boolean;
  };
  participants: { userId: string; role: string }[];
}
interface Inbox {
  data: { id: string; context: Room['context'] }[];
  meta: { nextCursor: string | null };
}

describe('organization order chat — full AppModule + PostgreSQL + Redis', () => {
  let c: Context;
  let baseUrl: string;
  const client = () => request(c.app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const roomPath = (id: string) => `/api/me/conversations/${id}`;
  const fixture = () => memberCapabilitiesFixture(c);
  const customer = () => memberTestUser(c.prisma, c.jwt);
  const colleague = (f: Worker) =>
    memberCapabilitiesFixture(c, { owner: f.owner, provider: f.provider });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOQAAAABJRU5ErkJggg==',
    'base64',
  );
  const uploadChatImage = jest.fn().mockImplementation(() =>
    Promise.resolve({
      publicId: `test/chat/${randomUUID()}`,
      format: 'png',
      deliveryType: 'authenticated',
      resourceType: 'image',
      width: 1,
      height: 1,
    }),
  );
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
    baseUrl = await c.app.getUrl();
    Object.assign(c.mediaStorage, { uploadChatImage });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  async function consult(
    f: Worker,
    user: Customer,
    text = 'PRIVATE CONSULTATION BEFORE BOOKING',
  ) {
    const res = await client()
      .post('/api/me/conversations')
      .set('Authorization', auth(user.token))
      .send({ providerId: f.provider.id, clientMessageId: randomUUID(), text })
      .expect(200);
    return (res.body as Envelope<{ conversationId: string }>).data
      .conversationId;
  }
  async function book(f: Worker, user: Customer, atOffset = 0) {
    const dto = {
      providerServiceId: f.offering.id,
      memberId: f.member.id,
      bookingType: 'SCHEDULED',
      scheduledAt: new Date(
        Math.ceil((Date.now() + 2 * 86400000) / 900000) * 900000 +
          atOffset * 60000,
      ).toISOString(),
      inlineAddress: {
        label: 'Nhà kiểm thử',
        addressLine: 'Địa chỉ riêng của khách kiểm thử',
        latitude: 21.029,
        longitude: 105.855,
      },
    };
    const quote = await client()
      .post('/api/orders/quote')
      .set('Authorization', auth(user.token))
      .send(dto)
      .expect(200);
    expect(
      (quote.body as Envelope<{ available: boolean }>).data.available,
    ).toBe(true);
    const key = randomUUID();
    const body = {
      ...dto,
      quoteToken: (quote.body as Envelope<{ quoteToken: string }>).data
        .quoteToken,
    };
    const response = await client()
      .post('/api/orders')
      .set('Authorization', auth(user.token))
      .set('idempotency-key', key)
      .send(body)
      .expect(201);
    return {
      ...(response.body as Envelope<{ id: string; conversationId: string }>)
        .data,
      body,
      key,
    };
  }
  const detail = (id: string, token: string) =>
    client().get(roomPath(id)).set('Authorization', auth(token));
  const messages = (id: string, token: string) =>
    client()
      .get(`${roomPath(id)}/messages`)
      .set('Authorization', auth(token));
  const send = (
    id: string,
    token: string,
    text: string,
    clientMessageId = randomUUID(),
  ) =>
    client()
      .post(`${roomPath(id)}/messages`)
      .set('Authorization', auth(token))
      .send({ clientMessageId, kind: 'TEXT', text });
  const inbox = (token: string, cursor?: string) =>
    client()
      .get('/api/me/conversations')
      .set('Authorization', auth(token))
      .query({ view: 'provider', limit: 1, ...(cursor ? { cursor } : {}) });

  it('keeps consultation private even if an unauthorized worker has a participant row', async () => {
    const f = await fixture(),
      user = await customer(),
      chat = await consult(f, user);
    await c.prisma.chatParticipantState.create({
      data: { conversationId: chat, userId: f.worker.id },
    });
    await detail(chat, f.worker.token).expect(404);
    await messages(chat, f.worker.token).expect(404);
    await send(chat, f.worker.token, 'Cannot read or reply').expect(404);
    const response = await detail(chat, f.owner.token).expect(200);
    expect((response.body as Envelope<Room>).data.context.type).toBe(
      'CONSULTATION',
    );
  });

  it('creates an isolated order room with exact participants and one audit grant on idempotent booking', async () => {
    const f = await fixture(),
      user = await customer(),
      chat = await consult(f, user);
    const o = await book(f, user);
    expect(o.conversationId).not.toBe(chat);
    const response = await detail(o.conversationId, f.worker.token).expect(200);
    const room = (response.body as Envelope<Room>).data;
    expect(room.context).toMatchObject({
      type: 'ORDER',
      orderId: o.id,
      workerCanChat: true,
      readOnly: false,
    });
    expect(room.participants.map((p) => p.userId).sort()).toEqual(
      [f.owner.id, f.worker.id, user.id].sort(),
    );
    const history = await messages(o.conversationId, f.worker.token).expect(
      200,
    );
    expect(JSON.stringify(history.body)).not.toContain('PRIVATE CONSULTATION');
    await client()
      .post('/api/orders')
      .set('Authorization', auth(user.token))
      .set('idempotency-key', o.key)
      .send(o.body)
      .expect(201);
    expect(
      await c.prisma.auditLog.count({
        where: {
          resourceId: o.conversationId,
          action: 'ORDER_CHAT_MEMBER_GRANTED',
        },
      }),
    ).toBe(1);
    expect(
      await c.prisma.chatConversation.count({
        where: { bookingOrderId: o.id },
      }),
    ).toBe(1);
  });

  it('delivers text to the correct three-party room, deduplicates retries and queues only other authorized parties', async () => {
    const f = await fixture(),
      user = await customer(),
      o = await book(f, user);
    const push = jest.spyOn(c.app.get(PushOutboxService), 'enqueue');
    const key = randomUUID();
    const response = await send(
      o.conversationId,
      f.worker.token,
      'Tôi chuẩn bị đến',
      key,
    ).expect(200);
    expect(
      (response.body as Envelope<{ message: Message }>).data.message.orderId,
    ).toBeNull();
    expect(push.mock.calls.map((call) => call[1].userId).sort()).toEqual(
      [user.id, f.owner.id].sort(),
    );
    await send(
      o.conversationId,
      f.worker.token,
      'Tôi chuẩn bị đến',
      key,
    ).expect(200);
    expect(push).toHaveBeenCalledTimes(2);
    await send(
      o.conversationId,
      f.worker.token,
      'Đổi nội dung cùng ID',
      key,
    ).expect(409);
    push.mockClear();
    await send(o.conversationId, user.token, 'Tôi sẽ đợi').expect(200);
    expect(push.mock.calls.map((call) => call[1].userId).sort()).toEqual(
      [f.owner.id, f.worker.id].sort(),
    );
    await messages(o.conversationId, f.owner.token).expect(200);
  });

  it('does not expose another order room when the customer uses the same organization again or rematches another worker', async () => {
    const f = await fixture(),
      second = await colleague(f),
      user = await customer();
    const first = await book(f, user),
      next = await book(second, user);
    expect(first.conversationId).not.toBe(next.conversationId);
    await send(
      first.conversationId,
      user.token,
      'Private request for worker A',
    ).expect(200);
    await detail(next.conversationId, f.worker.token).expect(404);
    await messages(first.conversationId, second.worker.token).expect(404);
    await send(next.conversationId, f.worker.token, 'Forbidden').expect(404);
    const response = await messages(
      next.conversationId,
      second.worker.token,
    ).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(
      'Private request for worker A',
    );
  });

  it('keeps provider inbox authorization intact while following a cursor', async () => {
    const f = await fixture(),
      user = await customer(),
      foreign = await fixture(),
      other = await customer();
    const one = await book(f, user),
      two = await book(f, user, 180),
      hidden = await book(foreign, other);
    const first = await inbox(f.worker.token).expect(200),
      firstPage = (first.body as Envelope<Inbox>).data;
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.meta.nextCursor).not.toBeNull();
    const next = await inbox(f.worker.token, firstPage.meta.nextCursor!).expect(
      200,
    );
    const ownIds = [
      ...firstPage.data,
      ...(next.body as Envelope<Inbox>).data.data,
    ].map((r) => r.id);
    expect(ownIds.sort()).toEqual(
      [one.conversationId, two.conversationId].sort(),
    );
    const forged = Buffer.from(
      JSON.stringify({
        id: hidden.conversationId,
        at: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toString('base64url');
    const filtered = await inbox(f.worker.token, forged).expect(200);
    expect(
      (filtered.body as Envelope<Inbox>).data.data.map((r) => r.id),
    ).not.toContain(hidden.conversationId);
  });

  it('allows writes in separate rooms of one organization while another room is locked', async () => {
    const f = await fixture(),
      second = await colleague(f),
      user = await customer();
    const one = await book(f, user),
      two = await book(second, user);
    let ready!: () => void, release!: () => void;
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transaction = c.prisma.$transaction(
      async (tx) => {
        await lockAccessibleChat(tx, one.conversationId, user.id);
        ready();
        await barrier;
      },
      { timeout: 10000 },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await acquired;
      const result = await Promise.race([
        send(
          two.conversationId,
          second.worker.token,
          'Independent room progress',
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error('Independent room was blocked by organization lock'),
              ),
            3000,
          );
        }),
      ]);
      expect(result.status).toBe(200);
    } finally {
      clearTimeout(timer);
      release();
      await transaction;
    }
  });

  it('sends private images in the assigned room only and replays without a second upload', async () => {
    const f = await fixture(),
      user = await customer(),
      second = await colleague(f),
      o = await book(f, user);
    const id = randomUUID(),
      before = uploadChatImage.mock.calls.length;
    const upload = (token: string) =>
      client()
        .post(`${roomPath(o.conversationId)}/images`)
        .set('Authorization', auth(token))
        .field('clientMessageId', id)
        .attach('files', png, {
          filename: 'sample.png',
          contentType: 'image/png',
        });
    const response = await upload(f.worker.token).expect(200);
    expect(
      (response.body as Envelope<{ message: Message }>).data.message,
    ).toMatchObject({ orderId: null });
    expect(
      (response.body as Envelope<{ message: Message }>).data.message
        .attachments[0].url,
    ).toBe('https://example.test/signed-private');
    await upload(f.worker.token).expect(200);
    expect(uploadChatImage.mock.calls.length).toBe(before + 1);
    await upload(second.worker.token).expect(404);
    expect(uploadChatImage.mock.calls.length).toBe(before + 1);
  });

  it('revokes worker REST/image/report/read/block access on suspension but retains owner/customer history', async () => {
    const f = await fixture(),
      user = await customer(),
      o = await book(f, user);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { status: 'SUSPENDED' },
    });
    for (const route of [
      roomPath(o.conversationId),
      `${roomPath(o.conversationId)}/messages`,
    ])
      await client()
        .get(route)
        .set('Authorization', auth(f.worker.token))
        .expect(404);
    await send(
      o.conversationId,
      f.worker.token,
      'Forbidden after suspension',
    ).expect(404);
    await client()
      .patch(`${roomPath(o.conversationId)}/read`)
      .set('Authorization', auth(f.worker.token))
      .send({ lastReadSequence: 1 })
      .expect(404);
    await client()
      .put(`${roomPath(o.conversationId)}/block`)
      .set('Authorization', auth(f.worker.token))
      .expect(404);
    await client()
      .post(`${roomPath(o.conversationId)}/reports`)
      .set('Authorization', auth(f.worker.token))
      .send({ reason: 'SPAM' })
      .expect(404);
    const before = uploadChatImage.mock.calls.length;
    await client()
      .post(`${roomPath(o.conversationId)}/images`)
      .set('Authorization', auth(f.worker.token))
      .field('clientMessageId', randomUUID())
      .attach('files', png, 'sample.png')
      .expect(404);
    expect(uploadChatImage.mock.calls.length).toBe(before);
    await messages(o.conversationId, f.owner.token).expect(200);
    await detail(o.conversationId, user.token).expect(200);
    expect(
      (await inbox(f.worker.token).expect(200)).body as Envelope<Inbox>,
    ).toMatchObject({ data: { data: [] } });
  });

  it('does not restore old chat permission after rejoin increments membership version', async () => {
    const f = await fixture(),
      user = await customer(),
      o = await book(f, user);
    await c.prisma.providerMember.update({
      where: { id: f.member.id },
      data: { membershipVersion: 2 },
    });
    await detail(o.conversationId, f.worker.token).expect(404);
    expect(
      (await inbox(f.worker.token).expect(200)).body as Envelope<Inbox>,
    ).toMatchObject({ data: { data: [] } });
    await detail(o.conversationId, user.token).expect(200);
  });

  it('rechecks permission after image upload and removes the upload if membership was revoked in flight', async () => {
    const f = await fixture(),
      user = await customer(),
      o = await book(f, user);
    const removed = jest.spyOn(c.mediaStorage, 'deleteImage');
    uploadChatImage.mockImplementationOnce(async () => {
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: { status: 'SUSPENDED' },
      });
      return {
        publicId: 'test/revoked-in-flight',
        format: 'png',
        deliveryType: 'authenticated',
        resourceType: 'image',
        width: 1,
        height: 1,
      };
    });
    await client()
      .post(`${roomPath(o.conversationId)}/images`)
      .set('Authorization', auth(f.worker.token))
      .field('clientMessageId', randomUUID())
      .attach('files', png, 'sample.png')
      .expect(404);
    expect(removed).toHaveBeenCalledWith(
      'test/revoked-in-flight',
      'authenticated',
    );
    expect(
      await c.prisma.chatMessage.count({
        where: { conversationId: o.conversationId, kind: 'IMAGE' },
      }),
    ).toBe(0);
  });

  it('makes rejected order rooms read-only without affecting the independent consultation', async () => {
    const f = await fixture(),
      user = await customer(),
      consultation = await consult(f, user),
      o = await book(f, user);
    await client()
      .post(`/api/me/provider/orders/${o.id}/reject`)
      .set('Authorization', auth(f.worker.token))
      .send({ reason: 'Không thể thực hiện khung giờ này' })
      .expect(200);
    expect(
      (
        (await detail(o.conversationId, user.token).expect(200))
          .body as Envelope<Room>
      ).data.context.readOnly,
    ).toBe(true);
    await send(o.conversationId, f.worker.token, 'No new messages').expect(409);
    await send(consultation, user.token, 'Tư vấn khung giờ khác').expect(200);
  });

  it('rejects forged room context/order links and keeps SQL participant rows insufficient for access', async () => {
    const f = await fixture(),
      second = await colleague(f),
      user = await customer(),
      one = await book(f, user),
      two = await book(second, user);
    await expect(
      c.prisma.serviceOrder.update({
        where: { id: one.id },
        data: { conversationId: two.conversationId },
      }),
    ).rejects.toThrow();
    await expect(
      c.prisma.chatConversation.update({
        where: { id: one.conversationId },
        data: { bookingOrderId: two.id, scopeKey: two.id },
      }),
    ).rejects.toThrow();
    await c.prisma.chatParticipantState.create({
      data: { conversationId: one.conversationId, userId: second.worker.id },
    });
    await detail(one.conversationId, second.worker.token).expect(404);
  });

  it('closes an active worker SSE stream after revocation and does not enqueue new messages for that worker', async () => {
    const f = await fixture(),
      user = await customer(),
      o = await book(f, user),
      abort = new AbortController();
    try {
      const response = await fetch(
        `${baseUrl}${roomPath(o.conversationId)}/events?afterSequence=0`,
        {
          headers: { Authorization: auth(f.worker.token) },
          signal: abort.signal,
        },
      );
      expect(response.status).toBe(200);
      const reader = response.body!.getReader();
      await reader.read();
      await c.prisma.providerMember.update({
        where: { id: f.member.id },
        data: { status: 'SUSPENDED' },
      });
      const push = jest.spyOn(c.app.get(PushOutboxService), 'enqueue');
      await send(
        o.conversationId,
        user.token,
        'Message after worker revocation',
      ).expect(200);
      expect(push.mock.calls.map((call) => call[1].userId)).not.toContain(
        f.worker.id,
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const end = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Revoked SSE did not close')),
              7000,
            );
          }),
        ]);
        expect(end.done).toBe(true);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      abort.abort();
    }
  });
});
