import { Injectable, Logger } from '@nestjs/common';
import { currentRequestId } from '../../../common/http/request-context';
import { normalizeConsultationText } from '../domain/consultation-reply.policy';
import { redactForGemini } from '../application/ai-privacy';

const CONSULTATION_INSTRUCTIONS = [
  'Bạn là trợ lý làm đẹp Lambe, trả lời tiếng Việt tự nhiên. Chỉ tư vấn tóc, makeup, nail, massage, spa, chăm sóc da; chủ đề khác đặt OUT_OF_SCOPE và từ chối ngắn gọn.',
  'Đưa 2-3 gợi ý cụ thể phù hợp hoàn cảnh và lý do, khoảng 60-100 từ. Nếu cần cá nhân hóa, hỏi tối đa một câu hữu ích qua followUpQuestion, không lặp trong reply. Không chẩn đoán hoặc điều trị bệnh.',
  'reply và followUpQuestion chỉ chứa tư vấn làm đẹp. Không nêu giá, tên thợ/cơ sở, khoảng cách, voucher, lịch trống, địa chỉ hay lời mời đặt dịch vụ: backend tự bổ sung dữ liệu thật và lời mời sau tư vấn. Không hỏi thông tin liên hệ hoặc giấy tờ.',
  'Trả JSON với reply, intent (CONSULTATION, PRICE_INQUIRY, PROVIDER_SEARCH, OUT_OF_SCOPE), searchTerms (tối đa 3 tên dịch vụ liên quan, không thông tin cá nhân), followUpQuestion (string hoặc null).',
].join(' ');

export interface ConsultationAnalysis {
  reply: string;
  intent: 'CONSULTATION' | 'PROVIDER_SEARCH' | 'PRICE_INQUIRY' | 'OUT_OF_SCOPE';
  searchTerms: string[];
  followUpQuestion: string | null;
  citations?: { title: string; url: string }[];
}

@Injectable()
export class GeminiConsultationService {
  private readonly logger = new Logger(GeminiConsultationService.name);

  async analyze(
    history: { role: string; text: string }[],
  ): Promise<ConsultationAnalysis | null> {
    if (process.env.GEMINI_ENABLED !== 'true') return null;
    const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
    const key = process.env.GEMINI_API_KEY;
    if (!key || !/^[a-zA-Z0-9._-]+$/.test(model)) return null;

    // Apply privacy filtering at the external boundary, including research and every history turn.
    const safeHistory = history.map((item) => ({
      ...item,
      text: redactForGemini(item.text),
    }));
    const latest = safeHistory.at(-1)?.text ?? '';
    const signal = AbortSignal.timeout(12000);
    if (
      process.env.GEMINI_WEB_SEARCH_ENABLED === 'true' &&
      /(?:tóc|nail|makeup|trang điểm|làm đẹp|massage|chăm sóc da|spa)/iu.test(
        latest,
      ) &&
      /(?:xu hướng|thịnh hành|mới nhất|trend|năm 20\d{2}|hiện nay)/iu.test(
        latest,
      )
    ) {
      const grounded = await this.researchTrend(latest, key, signal);
      if (grounded) return grounded;
    }
    if (signal.aborted) return null;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: CONSULTATION_INSTRUCTIONS,
                },
              ],
            },
            contents: safeHistory.map((item) => ({
              role: item.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: item.text }],
            })),
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 700,
              temperature: 0.5,
              // Supported for this configured Flash-Lite family; leave other model contracts unchanged.
              ...(/^gemini-3\.1-flash-lite(?:-preview)?$/.test(model)
                ? { thinkingConfig: { thinkingLevel: 'minimal' } }
                : {}),
            },
          }),
        },
      );
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const body = payload as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const item = value as Record<string, unknown>;
      const intents = [
        'CONSULTATION',
        'PROVIDER_SEARCH',
        'PRICE_INQUIRY',
        'OUT_OF_SCOPE',
      ];
      if (
        typeof item.reply !== 'string' ||
        !item.reply.trim() ||
        item.reply.length > 2500
      )
        return null;
      return {
        ...normalizeConsultationText(
          item.reply.trim(),
          typeof item.followUpQuestion === 'string'
            ? item.followUpQuestion
            : null,
        ),
        intent: intents.includes(String(item.intent))
          ? (item.intent as ConsultationAnalysis['intent'])
          : 'CONSULTATION',
        searchTerms: Array.isArray(item.searchTerms)
          ? item.searchTerms
              .filter(
                (term): term is string =>
                  typeof term === 'string' && term.length <= 80,
              )
              .slice(0, 3)
          : [],
      };
    } catch (error) {
      this.logger.warn({
        event: 'ai.gemini.unavailable',
        requestId: currentRequestId(),
        reason:
          error instanceof Error &&
          /^(?:Gemini HTTP \d{3})$/.test(error.message)
            ? error.message
            : 'request failed',
      });
      return null;
    }
  }

  private async researchTrend(
    question: string,
    key: string,
    signal: AbortSignal,
  ): Promise<ConsultationAnalysis | null> {
    try {
      const model = process.env.GEMINI_SEARCH_MODEL ?? 'gemini-3.8-flash';
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) return null;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Hãy tư vấn ngắn gọn bằng tiếng Việt về xu hướng làm đẹp được hỏi. Không tự bịa giá hay dịch vụ Lambe. Câu hỏi: ${question}`,
                  },
                ],
              },
            ],
            tools: [{ google_search: {} }],
            generationConfig: { maxOutputTokens: 700 },
          }),
        },
      );
      if (!response.ok)
        throw new Error(`Gemini search HTTP ${response.status}`);
      const payload = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          groundingMetadata?: {
            groundingChunks?: { web?: { title?: string; uri?: string } }[];
          };
        }[];
      };
      const candidate = payload.candidates?.[0];
      const reply = candidate?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();
      const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
        .flatMap((chunk) => {
          const source = chunk.web;
          if (!source?.uri || !source.title) return [];
          try {
            if (new URL(source.uri).protocol !== 'https:') return [];
          } catch {
            return [];
          }
          return [{ title: source.title.slice(0, 160), url: source.uri }];
        })
        .slice(0, 5);
      if (!reply || reply.length > 2500 || citations.length === 0) return null;
      return {
        ...normalizeConsultationText(reply),
        intent: 'CONSULTATION',
        searchTerms: [],
        citations,
      };
    } catch (error) {
      this.logger.warn({
        event: 'ai.gemini.search-unavailable',
        requestId: currentRequestId(),
        reason:
          error instanceof Error &&
          /^(?:Gemini search HTTP \d{3})$/.test(error.message)
            ? error.message
            : 'request failed',
      });
      return null;
    }
  }
}
