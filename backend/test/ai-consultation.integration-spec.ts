import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createOrganizationBookingTestApp } from './support/organization-booking-test-app';
import {
  memberTestOrganization,
  memberTestUser,
} from './support/provider-members.fixture';
import { GeminiConsultationService } from '../src/modules/ai-consultation/infrastructure/gemini-consultation.service';
import { AiRecommendationsService } from '../src/modules/ai-consultation/application/ai-recommendations.service';
import type { AiConsultationResult } from '../src/modules/ai-consultation/application/ai-consultation.service';
import { ObservabilityMetrics } from '../src/infrastructure/observability/observability-metrics.service';

type Context = Awaited<ReturnType<typeof createOrganizationBookingTestApp>>;
const path = (id: string) => `/api/me/ai-conversations/${id}`;
const auth = (token: string) => `Bearer ${token}`;
type Envelope<T> = { data: T };
const resultOf = (response: { body: unknown }) =>
  (response.body as Envelope<AiConsultationResult>).data;
const advice = {
  reply: 'Bạn có thể thử Side Part để tạo độ phồng tự nhiên.',
  intent: 'CONSULTATION' as const,
  searchTerms: ['cắt tóc'],
  followUpQuestion: 'Tóc mái hiện dài khoảng bao nhiêu?',
};

describe('AI consultation — HTTP, PostgreSQL and mocked Gemini', () => {
  let c: Context, analyze: jest.SpyInstance;
  const http = () => request(c.app.getHttpServer());
  beforeAll(async () => {
    c = await createOrganizationBookingTestApp();
    c.app.useLogger(false);
  });
  beforeEach(() => {
    analyze = jest
      .spyOn(c.app.get(GeminiConsultationService), 'analyze')
      .mockResolvedValue(advice);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await c?.app.close();
    await c?.prisma.$disconnect();
  });

  async function fixture() {
    const customer = await memberTestUser(c.prisma, c.jwt);
    const org = await memberTestOrganization(c.prisma, c.jwt, true);
    const key = randomUUID();
    const category = await c.prisma.serviceCategory.create({
      data: {
        code: `AI_${key.replaceAll('-', '_').toUpperCase()}`,
        slug: key,
        name: key,
        normalizedName: key,
        status: 'ACTIVE',
      },
    });
    const catalog = await c.prisma.service.create({
      data: {
        categoryId: category.id,
        code: `AI_${key.replaceAll('-', '_').toUpperCase()}`,
        slug: key,
        name: `Tóc ${key}`,
        normalizedName: `toc ${key}`,
        status: 'ACTIVE',
        minPriceAmount: 50000,
        maxPriceAmount: 500000,
      },
    });
    const offering = await c.prisma.providerService.create({
      data: {
        providerId: org.provider.id,
        serviceId: catalog.id,
        sourceApplicationId: org.provider.sourceApplicationId,
        priceAmount: 150000,
        durationMinutes: 45,
        status: 'ACTIVE',
      },
    });
    const post = await c.prisma.feedPost.create({
      data: {
        providerId: org.provider.id,
        caption: 'Mẫu tóc tham khảo',
        moderationStatus: 'APPROVED',
        recommendationStatus: 'ELIGIBLE',
        services: { create: { providerServiceId: offering.id } },
        media: {
          create: {
            kind: 'IMAGE',
            publicId: `test/ai/${key}`,
            secureUrl: 'https://example.test/beauty.webp',
            format: 'webp',
            position: 0,
          },
        },
      },
    });
    const conversation = await c.prisma.aiConversation.create({
      data: { userId: customer.id },
    });
    const clientMessageId = randomUUID();
    const result: AiConsultationResult = {
      clientMessageId,
      reply: advice.reply,
      intent: 'CONSULTATION',
      suggestedServices: [
        {
          id: catalog.id,
          name: catalog.name,
          slug: catalog.slug,
          minPriceAmount: catalog.minPriceAmount,
          maxPriceAmount: catalog.maxPriceAmount,
          currencyCode: 'VND',
        },
      ],
      suggestedProviders: [
        {
          id: org.provider.id,
          displayName: org.provider.displayName,
          avatarUrl: null,
          available: true,
          distanceKm: 2,
          service: {
            id: offering.id,
            priceAmount: 150000,
            durationMinutes: 45,
            service: {
              id: catalog.id,
              name: catalog.name,
              slug: catalog.slug,
              currencyCode: 'VND',
            },
          },
        },
      ],
      suggestedPosts: await c.app
        .get(AiRecommendationsService)
        .posts([catalog.id]),
      nextActions: [
        { type: 'VIEW_SERVICE', label: 'Xem dịch vụ', targetId: catalog.id },
        { type: 'VIEW_INSPIRATION', label: 'Xem mẫu', targetId: post.id },
        { type: 'FIND_PROVIDER', label: 'Xem thợ', targetId: catalog.id },
        { type: 'CREATE_QUOTE', label: 'Xem báo giá' },
      ],
      followUpQuestion: null,
      conversionPrompt: null,
      nextAction: 'SHOW_PROVIDERS',
      degradedMode: false,
      citations: [],
    };
    return {
      ...org,
      customer,
      category,
      catalog,
      offering,
      post,
      conversation,
      clientMessageId,
      result,
    };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function store(f: Fixture) {
    return c.prisma.aiMessage.create({
      data: {
        conversationId: f.conversation.id,
        role: 'user',
        clientMessageId: f.clientMessageId,
        text: 'Tư vấn tóc',
        result: f.result as unknown as Prisma.InputJsonValue,
      },
    });
  }
  const refresh = (f: Fixture, token = f.customer.token) =>
    http()
      .get(
        `${path(f.conversation.id)}/messages/${f.clientMessageId}/recommendations`,
      )
      .set('Authorization', auth(token));
  const send = (f: Fixture, text: string, clientMessageId = randomUUID()) =>
    http()
      .post(`${path(f.conversation.id)}/messages`)
      .set('Authorization', auth(f.customer.token))
      .send({ text, clientMessageId });
  const feedback = (f: Fixture, token = f.customer.token) =>
    http()
      .post(`${path(f.conversation.id)}/messages/${f.clientMessageId}/feedback`)
      .set('Authorization', auth(token));

  it('records one feedback per completed message and enforces ownership', async () => {
    const f = await fixture();
    const message = await store(f);
    await http()
      .post(`${path(f.conversation.id)}/messages/${f.clientMessageId}/feedback`)
      .send({ helpful: false, reason: 'NOT_RELEVANT' })
      .expect(401);
    await feedback(f, f.owner.token)
      .send({ helpful: false, reason: 'NOT_RELEVANT' })
      .expect(404);
    await feedback(f).send({ helpful: 'false' }).expect(400);
    await feedback(f).send({ helpful: false, reason: 'UNKNOWN' }).expect(400);
    await feedback(f)
      .send({ helpful: false, reason: 'NOT_RELEVANT' })
      .expect(200);
    await feedback(f).send({ helpful: true }).expect(200);
    expect(
      await c.prisma.aiMessageFeedback.findMany({
        where: { messageId: message.id },
      }),
    ).toEqual([
      expect.objectContaining({
        messageId: message.id,
        helpful: true,
        reason: null,
      }),
    ]);
    const history = await http()
      .get(`${path(f.conversation.id)}/messages`)
      .set('Authorization', auth(f.customer.token))
      .expect(200);
    expect(
      (history.body as { data: Array<{ feedback: unknown }> }).data[0].feedback,
    ).toEqual(expect.objectContaining({ helpful: true, reason: null }));
    await c.prisma.aiConversation.delete({ where: { id: f.conversation.id } });
    expect(
      await c.prisma.aiMessageFeedback.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
  });

  it('rejects feedback while a message is processing', async () => {
    const f = await fixture();
    const message = await c.prisma.aiMessage.create({
      data: {
        conversationId: f.conversation.id,
        role: 'user',
        clientMessageId: f.clientMessageId,
        text: 'Tư vấn tóc',
      },
    });
    await feedback(f).send({ helpful: false }).expect(409);
    expect(
      await c.prisma.aiMessageFeedback.count({
        where: { messageId: message.id },
      }),
    ).toBe(0);
  });

  it('requires authentication and rejects another account for history/send/refresh/delete', async () => {
    const f = await fixture();
    await store(f);
    await http()
      .get(
        `${path(f.conversation.id)}/messages/${f.clientMessageId}/recommendations`,
      )
      .expect(401);
    for (const method of ['get', 'delete'] as const)
      await http()
        [method](
          `${path(f.conversation.id)}${method === 'get' ? '/messages' : ''}`,
        )
        .set('Authorization', auth(f.owner.token))
        .expect(404);
    await refresh(f, f.owner.token).expect(404);
    await http()
      .post(`${path(f.conversation.id)}/messages`)
      .set('Authorization', auth(f.owner.token))
      .send({ text: 'Tư vấn tóc', clientMessageId: randomUUID() })
      .expect(404);
    expect(analyze).not.toHaveBeenCalled();
  });
  it('keeps concrete advice before conversion and returns real catalog/feed data', async () => {
    const f = await fixture();
    const response = await send(f, `Tư vấn ${f.catalog.name}`).expect(200);
    const result = (response.body as Envelope<AiConsultationResult>).data;
    expect(result.reply).toContain('Side Part');
    expect(result.nextAction).toBe('CONTINUE_CONSULTATION');
    expect(result.followUpQuestion).toBe(advice.followUpQuestion);
    expect(result.suggestedProviders).toEqual([]);
    expect(result.suggestedServices).toContainEqual(
      expect.objectContaining({
        id: f.catalog.id,
        minPriceAmount: 50000,
        maxPriceAmount: 500000,
      }),
    );
    expect(result.suggestedPosts).toContainEqual(
      expect.objectContaining({ id: f.post.id }),
    );
  });
  it('answers explicit price requests from the database without calling Gemini', async () => {
    const f = await fixture();
    const response = await send(f, `${f.catalog.name} giá bao nhiêu?`).expect(
      200,
    );
    expect(resultOf(response).reply).toContain('50.000');
    expect(resultOf(response).reply).toContain('500.000');
    expect(analyze).not.toHaveBeenCalled();
  });
  it.each([
    'Tôi có nên nuôi mèo?',
    'Ngày mai nên ăn gì?',
    'Thời tiết hôm nay thế nào?',
  ])('rejects unrelated requests without a model call: %s', async (text) => {
    const f = await fixture();
    const res = await send(f, text).expect(200);
    expect(resultOf(res).intent).toBe('OUT_OF_SCOPE');
    expect(resultOf(res).suggestedPosts).toEqual([]);
    expect(analyze).not.toHaveBeenCalled();
  });
  it('filters every history turn before the adapter while retaining the original privately in Lambe', async () => {
    const f = await fixture();
    await c.prisma.aiMessage.create({
      data: {
        conversationId: f.conversation.id,
        role: 'user',
        text: '123 Lê Lợi, Quận 1; phone 0912345678',
      },
    });
    await send(f, 'Tư vấn kiểu tóc đi date').expect(200);
    expect(JSON.stringify(analyze.mock.calls)).not.toMatch(/Lê Lợi|0912345678/);
    expect(
      await c.prisma.aiMessage.count({
        where: {
          conversationId: f.conversation.id,
          text: { contains: 'Lê Lợi' },
        },
      }),
    ).toBe(1);
  });
  it('removes generated prices, promotions and unsafe follow-ups without losing the useful advice', async () => {
    const f = await fixture();
    analyze.mockResolvedValue({
      ...advice,
      reply: 'Bạn có thể thử Side Part. Giá chỉ ba trăm nghìn đồng.',
      followUpQuestion: 'Bạn muốn dùng voucher GIAMGIA?',
    });
    const res = await send(f, 'Gợi ý tóc đi date').expect(200);
    expect(resultOf(res).reply).toBe('Bạn có thể thử Side Part.');
    expect(resultOf(res).followUpQuestion).toBeNull();
    expect(resultOf(res).degradedMode).toBe(true);
  });
  it('persists the user message and useful fallback when Gemini is unavailable', async () => {
    const metrics = c.app.get(ObservabilityMetrics);
    const before = metrics.snapshot().events['ai.intent'].CONSULTATION;
    const f = await fixture();
    analyze.mockResolvedValue(null);
    const id = randomUUID();
    const res = await send(f, 'Tư vấn kiểu tóc', id).expect(200);
    expect(resultOf(res).degradedMode).toBe(true);
    expect(
      await c.prisma.aiMessage.count({
        where: { conversationId: f.conversation.id },
      }),
    ).toBe(2);
    expect(
      resultOf(await send(f, 'Tư vấn kiểu tóc', id).expect(200)).reply,
    ).toBe(resultOf(res).reply);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().events['ai.intent'].CONSULTATION - before).toBe(
      1,
    );
  });
  it('claims one request under concurrency and rejects idempotency-key reuse for changed content', async () => {
    const f = await fixture();
    const id = randomUUID();
    let started!: () => void, release!: (value: typeof advice) => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    analyze.mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const first = send(f, 'Tư vấn tóc', id).then((r) => r);
    await Promise.race([
      entered,
      first.then((response) => {
        throw new Error(
          `First request ended before model call: ${response.status}`,
        );
      }),
    ]);
    try {
      await send(f, 'Tư vấn tóc', id).expect(409);
    } finally {
      release(advice);
    }
    expect((await first).status).toBe(200);
    await send(f, 'Đổi nội dung', id).expect(409);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(
      await c.prisma.aiMessage.count({
        where: { conversationId: f.conversation.id },
      }),
    ).toBe(2);
  });
  it('retries the same message after a catalog failure without spending a daily use', async () => {
    const f = await fixture();
    const id = randomUUID();
    jest
      .spyOn(c.app.get(AiRecommendationsService), 'services')
      .mockRejectedValueOnce(new Error('Catalog unavailable'));
    await send(f, 'Cắt tóc giá bao nhiêu?', id).expect(500);
    const failed = await c.prisma.aiMessage.findUniqueOrThrow({
      where: {
        conversationId_clientMessageId: {
          conversationId: f.conversation.id,
          clientMessageId: id,
        },
      },
    });
    expect(failed.processingToken).toBeNull();
    expect(
      await c.prisma.aiUsageEntry.count({ where: { userId: f.customer.id } }),
    ).toBe(0);
    await send(f, 'Cắt tóc giá bao nhiêu?', id).expect(200);
    expect(
      await c.prisma.aiUsageEntry.count({ where: { userId: f.customer.id } }),
    ).toBe(1);
  });
  it('enforces the daily limit across concurrent requests and deleted conversations', async () => {
    const f = await fixture();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await c.prisma.aiUsageEntry.createMany({
      data: Array.from({ length: 49 }, () => ({
        messageId: randomUUID(),
        userId: f.customer.id,
        day: today,
      })),
    });
    const responses = await Promise.all([
      send(f, 'Tôi có nên nuôi mèo không?'),
      send(f, 'Ngày mai nên ăn gì?'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 429,
    ]);
    await c.prisma.aiConversation.delete({ where: { id: f.conversation.id } });
    const next = await c.prisma.aiConversation.create({
      data: { userId: f.customer.id },
    });
    await http()
      .post(`${path(next.id)}/messages`)
      .set('Authorization', auth(f.customer.token))
      .send({ text: 'Tư vấn tóc', clientMessageId: randomUUID() })
      .expect(429);
  });
  it('validates message IDs, missing messages and results still processing', async () => {
    const f = await fixture();
    await http()
      .get(`${path(f.conversation.id)}/messages/not-a-uuid/recommendations`)
      .set('Authorization', auth(f.customer.token))
      .expect(400);
    await refresh(f).expect(404);
    await c.prisma.aiMessage.create({
      data: {
        conversationId: f.conversation.id,
        role: 'user',
        clientMessageId: f.clientMessageId,
        text: 'Tư vấn',
      },
    });
    await refresh(f).expect(409);
  });
  it('does not mark an unchanged JSONB snapshot as expired merely because object key order differs', async () => {
    const f = await fixture();
    await store(f);
    const res = await refresh(f).expect(200);
    expect(resultOf(res).suggestionsExpired).toBe(false);
  });
  it('continues from the previous beauty advice when the user asks to find someone for that service', async () => {
    const f = await fixture();
    await store(f);
    const res = await send(f, 'Tìm chuyên viên phù hợp cho dịch vụ này').expect(
      200,
    );
    expect(resultOf(res).intent).toBe('PROVIDER_SEARCH');
    expect(resultOf(res).suggestedServices).toContainEqual(
      expect.objectContaining({ id: f.catalog.id }),
    );
    expect(analyze).not.toHaveBeenCalled();
  });
  it.each([
    'service',
    'category',
    'provider',
    'account',
    'offering',
    'post',
  ] as const)(
    'removes inactive %s cards/actions without modifying the stored snapshot',
    async (kind) => {
      const f = await fixture();
      const original = await store(f);
      if (kind === 'service')
        await c.prisma.service.update({
          where: { id: f.catalog.id },
          data: { status: 'INACTIVE' },
        });
      if (kind === 'category')
        await c.prisma.serviceCategory.update({
          where: { id: f.category.id },
          data: { status: 'INACTIVE' },
        });
      if (kind === 'provider')
        await c.prisma.providerProfile.update({
          where: { id: f.provider.id },
          data: { status: 'SUSPENDED' },
        });
      if (kind === 'account')
        await c.prisma.user.update({
          where: { id: f.owner.id },
          data: { status: 'BLOCKED' },
        });
      if (kind === 'offering')
        await c.prisma.providerService.update({
          where: { id: f.offering.id },
          data: { status: 'INACTIVE' },
        });
      if (kind === 'post')
        await c.prisma.feedPost.update({
          where: { id: f.post.id },
          data: { status: 'HIDDEN' },
        });
      const res = await refresh(f).expect(200);
      const data = (res.body as Envelope<AiConsultationResult>).data;
      expect(data.suggestionsExpired).toBe(true);
      expect(data.suggestedPosts).toEqual([]);
      if (kind !== 'post') {
        expect(data.suggestedProviders).toEqual([]);
        expect(data.nextActions.some((a) => a.type === 'CREATE_QUOTE')).toBe(
          false,
        );
      }
      if (kind === 'service' || kind === 'category') {
        expect(data.suggestedServices).toEqual([]);
        expect(data.nextActions).toEqual([]);
      }
      expect(
        (
          await c.prisma.aiMessage.findUniqueOrThrow({
            where: { id: original.id },
          })
        ).result,
      ).toEqual(original.result);
      expect(analyze).not.toHaveBeenCalled();
    },
  );
  it('refreshes catalog/provider prices using real rows and keeps text as a historical message', async () => {
    const f = await fixture();
    await store(f);
    await c.prisma.providerService.update({
      where: { id: f.offering.id },
      data: { priceAmount: 180000 },
    });
    await c.prisma.service.update({
      where: { id: f.catalog.id },
      data: { minPriceAmount: 60000, maxPriceAmount: 400000 },
    });
    const res = await refresh(f).expect(200);
    expect(resultOf(res).suggestedServices[0].minPriceAmount).toBe(60000);
    expect(
      (
        resultOf(res).suggestedProviders[0] as {
          service: { priceAmount: number };
        }
      ).service.priceAmount,
    ).toBe(180000);
    expect(resultOf(res).reply).toBe(advice.reply);
    expect(analyze).not.toHaveBeenCalled();
  });
  it('refreshes a history page in a fixed number of queries and rejects clicks on withdrawn targets', async () => {
    const f = await fixture();
    await store(f);
    await c.prisma.aiMessage.createMany({
      data: Array.from({ length: 20 }, () => ({
        conversationId: f.conversation.id,
        role: 'assistant',
        text: advice.reply,
        result: f.result as unknown as Prisma.InputJsonValue,
      })),
    });
    const services = jest.spyOn(c.prisma.service, 'findMany'),
      offerings = jest.spyOn(c.prisma.providerService, 'findMany'),
      posts = jest.spyOn(c.prisma.feedPost, 'findMany');
    const res = await http()
      .get(`${path(f.conversation.id)}/messages`)
      .set('Authorization', auth(f.customer.token))
      .expect(200);
    expect((res.body as Envelope<unknown[]>).data).toHaveLength(21);
    expect(services).toHaveBeenCalledTimes(1);
    expect(offerings).toHaveBeenCalledTimes(1);
    expect(posts).toHaveBeenCalledTimes(1);
    await c.prisma.feedPost.update({
      where: { id: f.post.id },
      data: { status: 'HIDDEN' },
    });
    await http()
      .post(`${path(f.conversation.id)}/actions`)
      .set('Authorization', auth(f.customer.token))
      .send({
        clientMessageId: f.clientMessageId,
        type: 'VIEW_INSPIRATION',
        targetId: f.post.id,
      })
      .expect(400);
    expect(
      await c.prisma.aiActionEvent.count({ where: { userId: f.customer.id } }),
    ).toBe(0);
  });
});
