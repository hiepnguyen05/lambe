import 'dotenv/config';
import { GeminiConsultationService } from '../src/modules/ai-consultation/infrastructure/gemini-consultation.service';
import {
  containsUnsupportedClaim,
  safeConsultationAdvice,
} from '../src/modules/ai-consultation/application/ai-privacy';

// Explicit opt-in: five synthetic questions, never load customer conversations or addresses.
async function main() {
  if (!process.argv.includes('--live'))
    throw new Error(
      'Pass --live to authorize five Gemini requests using the configured key.',
    );
  if (process.env.GEMINI_ENABLED !== 'true' || !process.env.GEMINI_API_KEY)
    throw new Error('Gemini is not configured.');
  process.env.GEMINI_WEB_SEARCH_ENABLED = 'false';
  const adapter = new GeminiConsultationService();
  const questions = [
    [
      'hair',
      'Mặt tròn, tóc dày, tóc mái dài 6 cm. Gợi ý kiểu tóc cho buổi hẹn đầu tiên.',
    ],
    [
      'nail',
      'Gợi ý mẫu nail nhẹ nhàng cho người đi làm văn phòng, thích màu nude.',
    ],
    ['makeup', 'Gợi ý makeup tone hồng nhẹ nhàng cho buổi gặp mặt ban ngày.'],
    ['massage', 'Muốn thư giãn nhẹ sau giờ làm, nên chọn kiểu massage nào?'],
    [
      'skin',
      'Da nhạy cảm, muốn trang điểm nhẹ nhàng đi làm. Gợi ý phong cách phù hợp.',
    ],
  ];
  let completed = 0;
  for (const [topic, text] of questions) {
    const started = performance.now();
    const answer = await adapter.analyze([{ role: 'user', text }]);
    const reply = answer ? safeConsultationAdvice(answer.reply) : '';
    if (reply) completed++;
    console.log(
      JSON.stringify({
        topic,
        elapsedMs: Math.round(performance.now() - started),
        modelResponded: !!answer,
        reply,
        followUpQuestion:
          answer?.followUpQuestion &&
          !containsUnsupportedClaim(answer.followUpQuestion)
            ? answer.followUpQuestion
            : null,
      }),
    );
  }
  console.log(
    JSON.stringify({ completed, total: questions.length, syntheticOnly: true }),
  );
  if (completed !== questions.length) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    'Evaluation could not complete; check configuration/network without printing credentials.',
  );
  process.exitCode = 1;
});
