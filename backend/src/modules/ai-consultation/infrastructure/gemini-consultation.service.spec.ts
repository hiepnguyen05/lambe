import { GeminiConsultationService } from './gemini-consultation.service';

describe('GeminiConsultationService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns fallback control to the application on a timed out request', async () => {
    process.env.GEMINI_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_WEB_SEARCH_ENABLED = 'false';
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('request timed out'));
    await expect(
      new GeminiConsultationService().analyze([
        { role: 'user', text: 'Gợi ý kiểu tóc đi date' },
      ]),
    ).resolves.toBeNull();
  });

  it('keeps useful advice when Gemini returns an unknown intent', async () => {
    process.env.GEMINI_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
    process.env.GEMINI_WEB_SEARCH_ENABLED = 'false';

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: 'Bạn có thể thử kiểu Side Part.',
                      intent: 'NONE',
                      searchTerms: [],
                      followUpQuestion: null,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new GeminiConsultationService().analyze([
        { role: 'user', text: 'Gợi ý kiểu tóc đi hẹn hò?' },
      ]),
    ).resolves.toEqual({
      reply: 'Bạn có thể thử kiểu Side Part.',
      intent: 'CONSULTATION',
      searchTerms: [],
      followUpQuestion: null,
    });
  });

  it('filters every historical turn at the external boundary, not only the latest question', async () => {
    process.env.GEMINI_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_WEB_SEARCH_ENABLED = 'false';
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}'));
    await new GeminiConsultationService().analyze([
      { role: 'user', text: 'Email an@example.com, phone 0912345678' },
      { role: 'assistant', text: 'CCCD: AB1234567' },
      { role: 'user', text: '123 Lê Lợi, Quận 1' },
    ]);
    const body = fetcher.mock.calls[0][1]?.body as string;
    expect(body).not.toMatch(/an@example|0912345678|AB1234567|Lê Lợi/);
  });

  it('redacts research questions and uses one shared timeout budget for search and normal completion', async () => {
    process.env.GEMINI_ENABLED = 'true';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_WEB_SEARCH_ENABLED = 'true';
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('{}')));
    await new GeminiConsultationService().analyze([
      { role: 'user', text: 'Xu hướng tóc mới nhất. Email an@example.com' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.signal).toBe(
      fetcher.mock.calls[1][1]?.signal,
    );
    expect(fetcher.mock.calls[0][1]?.body).not.toContain('an@example.com');
  });
});
