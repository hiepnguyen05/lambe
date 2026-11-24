import { BookingType } from '@prisma/client';
import { AiConsultationService } from './ai-consultation.service';
import { AiMessageProcessingService } from './ai-message-processing.service';

const messageId = '11111111-1111-4111-8111-111111111111';

function fixture(
  reply: {
    intent: string;
    searchTerms: string[];
    reply: string;
    followUpQuestion?: string;
    citations?: { title: string; url: string }[];
  } | null,
) {
  const prisma = {
    aiConversation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'conversation' }),
      update: jest.fn().mockReturnValue(Promise.resolve()),
    },
    aiMessage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'message' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest
        .fn()
        .mockResolvedValue([{ role: 'user', text: 'Tư vấn kiểu tóc đi date' }]),
      update: jest.fn().mockReturnValue(Promise.resolve()),
    },
    service: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'service',
          name: 'Cắt tóc nam',
          description: null,
          minPriceAmount: 100000,
          maxPriceAmount: 200000,
          currencyCode: 'VND',
        },
      ]),
    },
    customerAddress: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    aiActionEvent: { create: jest.fn().mockResolvedValue({}) },
    aiUsageEntry: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (action: (transaction: unknown) => Promise<unknown>) => action(prisma),
  );
  const gemini = { analyze: jest.fn().mockResolvedValue(reply) };
  const discovery = {
    search: jest.fn().mockResolvedValue({ data: [{ id: 'provider' }] }),
  };
  const recommendations = {
    services: jest.fn().mockResolvedValue([
      {
        id: 'service',
        name: 'Cắt tóc nam',
        minPriceAmount: 100000,
        maxPriceAmount: 200000,
        currencyCode: 'VND',
      },
    ]),
    posts: jest.fn().mockResolvedValue([]),
  };
  const service = new AiConsultationService(
    prisma as never,
    gemini as never,
    discovery as never,
    recommendations as never,
    {
      refresh: jest.fn((r: unknown) => Promise.resolve(r)),
      refreshMany: jest.fn((r: unknown[]) => Promise.resolve(r)),
    } as never,
    new AiMessageProcessingService(prisma as never),
  );
  return { service, prisma, gemini, discovery, recommendations };
}

describe('AiConsultationService', () => {
  it('never exposes generated commercial claims through follow-up questions or citations', async () => {
    const { service } = fixture({
      intent: 'CONSULTATION',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Bạn có thể thử Side Part. Giá chỉ ba trăm nghìn đồng.',
      followUpQuestion: 'Bạn muốn dùng voucher GIAMGIA?',
      citations: [{ title: 'Giá chỉ 99k', url: 'https://example.test' }],
    });
    const { data } = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tư vấn tóc',
    });
    expect(data.reply).toBe('Bạn có thể thử Side Part.');
    expect(data.followUpQuestion).toBeNull();
    expect(data.citations).toEqual([]);
    expect(data.degradedMode).toBe(true);
  });
  it.each([
    'Tìm thợ cắt tóc giúp tôi',
    'Cắt tóc giá bao nhiêu?',
    'Tôi có nên nuôi mèo?',
  ])(
    'does not send deterministic operational or unrelated requests to Gemini: %s',
    async (text) => {
      const { service, gemini } = fixture(null);
      await service.send('customer', 'conversation', {
        clientMessageId: messageId,
        text,
      });
      expect(gemini.analyze).not.toHaveBeenCalled();
    },
  );
  it('keeps style consultation focused on advice', async () => {
    const { service, discovery } = fixture({
      intent: 'PROVIDER_SEARCH',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Với mặt tròn, Side Part 6/4 giúp phần đỉnh có độ phồng tự nhiên.',
    });
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tư vấn kiểu tóc đi date',
      latitude: 21,
      longitude: 105,
    });
    expect(result.data.intent).toBe('CONSULTATION');
    expect(result.data.reply).toContain('Side Part');
    expect(result.data.suggestedProviders).toEqual([]);
    expect(discovery.search).not.toHaveBeenCalled();
    expect(result.data.suggestedServices).toHaveLength(1);
    expect(result.data.nextAction).toBe('OFFER_PROVIDER_SEARCH');
    expect(result.data.conversionPrompt).toContain('chuyên viên');
  });

  it('continues provider search when the customer accepts the previous offer', async () => {
    const { service, prisma, discovery } = fixture({
      intent: 'PROVIDER_SEARCH',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Mình sẽ tìm chuyên viên phù hợp cho bạn.',
    });
    prisma.aiMessage.findFirst.mockResolvedValue({
      result: { nextAction: 'OFFER_PROVIDER_SEARCH' },
    });

    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Được',
    });

    expect(result.data.intent).toBe('PROVIDER_SEARCH');
    expect(result.data.nextAction).toBe('REQUEST_LOCATION');
    expect(result.data.reply).toContain('địa chỉ');
    expect(discovery.search).not.toHaveBeenCalled();
  });

  it('keeps the selected service when location is sent in the next message', async () => {
    const { service, prisma, discovery } = fixture({
      intent: 'PROVIDER_SEARCH',
      searchTerms: [],
      reply: 'Mình sẽ dùng vị trí hiện tại của bạn.',
    });
    prisma.aiMessage.findFirst.mockResolvedValue({
      result: {
        nextAction: 'REQUEST_LOCATION',
        suggestedServices: [{ name: 'Cắt tóc nam' }],
      },
    });

    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tìm chuyên viên phù hợp gần vị trí hiện tại của tôi',
      latitude: 21,
      longitude: 105,
      bookingType: BookingType.ASAP,
    });

    expect(result.data.nextAction).toBe('SHOW_PROVIDERS');
    expect(discovery.search).toHaveBeenCalledWith(
      'customer',
      expect.objectContaining({ serviceId: 'service' }),
    );
  });

  it('does not answer an out-of-scope question', async () => {
    const { service, prisma, discovery } = fixture({
      intent: 'OUT_OF_SCOPE',
      searchTerms: [],
      reply: 'Bạn nên nuôi mèo vì mèo rất đáng yêu.',
    });

    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tôi có nên nuôi mèo không?',
    });

    expect(result.data.intent).toBe('OUT_OF_SCOPE');
    expect(result.data.reply).not.toContain('nên nuôi mèo');
    expect(result.data.reply).toContain('làm đẹp');
    expect(result.data.suggestedServices).toEqual([]);
    expect(prisma.service.findMany).not.toHaveBeenCalled();
    expect(discovery.search).not.toHaveBeenCalled();
  });

  it.each([
    'Tôi có nên nuôi mèo không?',
    'Ngày mai nên ăn gì?',
    'Thời tiết hôm nay thế nào?',
  ])(
    'rejects outside topic even when Gemini is unavailable: %s',
    async (question) => {
      const { service, discovery } = fixture(null);
      const result = await service.send('customer', 'conversation', {
        clientMessageId: messageId,
        text: question,
      });
      expect(result.data.intent).toBe('OUT_OF_SCOPE');
      expect(result.data.suggestedPosts).toEqual([]);
      expect(discovery.search).not.toHaveBeenCalled();
    },
  );

  it('does not repeat invented prices from the model', async () => {
    const { service } = fixture({
      intent: 'CONSULTATION',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Tóc Side Part phù hợp, giá thợ là 99k.',
    });
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tư vấn kiểu tóc đi date',
    });
    expect(result.data.reply).not.toContain('99k');
    expect(result.data.suggestedProviders).toEqual([]);
  });

  it('uses actual services and discovery only after an explicit provider request', async () => {
    const { service, discovery } = fixture({
      intent: 'PROVIDER_SEARCH',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Tôi đã tìm được thợ.',
    });
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tìm thợ cắt tóc giúp tôi',
      latitude: 21,
      longitude: 105,
      bookingType: BookingType.ASAP,
    });
    expect(result.data.suggestedServices).toHaveLength(1);
    expect(result.data.suggestedProviders).toEqual([{ id: 'provider' }]);
    expect(discovery.search).toHaveBeenCalledWith(
      'customer',
      expect.objectContaining({ serviceId: 'service' }),
    );
  });

  it('uses only the current customer default address and asks for time first', async () => {
    const { service, prisma, discovery } = fixture({
      intent: 'PROVIDER_SEARCH',
      searchTerms: ['Cắt tóc nam'],
      reply: 'Mình sẽ tìm thợ.',
    });
    prisma.customerAddress.findFirst.mockResolvedValue({ id: 'my-default' });
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Tìm thợ cắt tóc giúp tôi',
    });
    expect(prisma.customerAddress.findFirst).toHaveBeenCalledWith({
      where: { userId: 'customer', isDefault: true },
      select: { id: true },
    });
    expect(result.data.nextAction).toBe('REQUEST_BOOKING_TIME');
    expect(discovery.search).not.toHaveBeenCalled();
  });

  it('rejects access to someone else conversation', async () => {
    const { service, prisma, gemini } = fixture(null);
    prisma.aiConversation.findFirst.mockResolvedValue(null);
    await expect(
      service.send('other', 'conversation', {
        clientMessageId: messageId,
        text: 'Xin chào',
      }),
    ).rejects.toThrow('Không tìm thấy hội thoại');
    expect(gemini.analyze).not.toHaveBeenCalled();
  });

  it('replays the result without calling Gemini twice', async () => {
    const { service, prisma, gemini } = fixture(null);
    prisma.aiMessage.findUnique.mockResolvedValue({
      text: 'Xin chào',
      result: { reply: 'Chào bạn' },
    });
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Xin chào',
    });
    expect(result.data).toEqual({ reply: 'Chào bạn' });
    expect(gemini.analyze).not.toHaveBeenCalled();
  });

  it('releases a failed claim so the same message can be retried', async () => {
    const { service, prisma, recommendations } = fixture(null);
    prisma.aiMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        text: 'Cắt tóc giá bao nhiêu?',
        result: null,
        processingToken: null,
        processingStartedAt: null,
      });
    recommendations.services.mockRejectedValueOnce(
      new Error('Catalog unavailable'),
    );

    const input = {
      clientMessageId: messageId,
      text: 'Cắt tóc giá bao nhiêu?',
    };
    await expect(
      service.send('customer', 'conversation', input),
    ).rejects.toThrow('Catalog unavailable');
    expect(prisma.aiMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { processingToken: null, processingStartedAt: null },
      }),
    );
    await expect(
      service.send('customer', 'conversation', input),
    ).resolves.toEqual(expect.objectContaining({ success: true }));
  });

  it('reclaims a message left behind by a stopped worker', async () => {
    const { service, prisma } = fixture(null);
    prisma.aiMessage.findUnique.mockResolvedValue({
      text: 'Cắt tóc giá bao nhiêu?',
      result: null,
      processingToken: 'old-worker',
      processingStartedAt: new Date(Date.now() - 6 * 60_000),
    });
    await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Cắt tóc giá bao nhiêu?',
    });
    expect(prisma.aiMessage.update).toHaveBeenCalledTimes(1);
  });

  it('rejects a duplicate while the first request is still processing', async () => {
    const { service, prisma, gemini } = fixture(null);
    prisma.aiMessage.findUnique.mockResolvedValue({
      text: 'Tư vấn tóc',
      result: null,
      processingToken: 'active-worker',
      processingStartedAt: new Date(),
    });
    await expect(
      service.send('customer', 'conversation', {
        clientMessageId: messageId,
        text: 'Tư vấn tóc',
      }),
    ).rejects.toThrow('Tin nhắn đang được xử lý');
    expect(gemini.analyze).not.toHaveBeenCalled();
  });

  it('enforces persisted daily usage independently of message rows', async () => {
    const { service, prisma, gemini } = fixture(null);
    prisma.aiUsageEntry.count.mockResolvedValue(50);
    await expect(
      service.send('customer', 'conversation', {
        clientMessageId: messageId,
        text: 'Tư vấn tóc',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
    expect(gemini.analyze).not.toHaveBeenCalled();
  });

  it('does not save a reply when the processing claim has expired', async () => {
    const { service, prisma } = fixture(null);
    prisma.aiMessage.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.send('customer', 'conversation', {
        clientMessageId: messageId,
        text: 'Tư vấn tóc',
      }),
    ).rejects.toThrow('Tin nhắn đã được xử lý bởi yêu cầu khác');
    expect(prisma.aiUsageEntry.create).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(1);
  });

  it('persists a useful fallback and the assistant cards when Gemini times out', async () => {
    const { service, prisma } = fixture(null);
    const result = await service.send('customer', 'conversation', {
      clientMessageId: messageId,
      text: 'Gợi ý kiểu tóc phù hợp',
    });
    expect(result.data.degradedMode).toBe(true);
    expect(result.data.reply).toContain('kiểu tóc');
    expect(prisma.aiMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conversation',
        role: 'assistant',
        text: result.data.reply,
        result: result.data,
      },
    });
    expect(prisma.aiMessage.updateMany).toHaveBeenCalled();
  });

  it('records only an action present in the owned response', async () => {
    const { service, prisma } = fixture(null);
    prisma.aiMessage.findUnique.mockResolvedValue({
      id: 'message',
      result: { nextActions: [{ type: 'VIEW_SERVICE', targetId: 'service' }] },
    });
    await expect(
      service.recordAction('customer', 'conversation', {
        clientMessageId: messageId,
        type: 'VIEW_SERVICE',
        targetId: 'service',
      }),
    ).resolves.toEqual({ success: true, data: { recorded: true } });
    expect(prisma.aiActionEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer',
        messageId: 'message',
        actionType: 'VIEW_SERVICE',
        targetId: 'service',
      },
    });
    await expect(
      service.recordAction('customer', 'conversation', {
        clientMessageId: messageId,
        type: 'CREATE_QUOTE',
        targetId: 'service',
      }),
    ).rejects.toThrow('Gợi ý không còn hợp lệ');
  });
});
