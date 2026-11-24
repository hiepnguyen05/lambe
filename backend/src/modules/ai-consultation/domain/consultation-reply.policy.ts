/** Keep one follow-up outside the advice so clients do not render it twice. */
export function normalizeConsultationText(
  reply: string,
  followUp?: string | null,
) {
  const sentences = reply.match(/[^.!?]+[.!?]*/gu) ?? [reply];
  const questions = sentences.filter((sentence) => sentence.includes('?'));
  const candidate = followUp?.trim() || questions[0]?.trim() || null;
  const followUpQuestion = candidate
    ? (candidate.includes('?')
        ? `${candidate.split('?')[0].trim()}?`
        : candidate
      ).slice(0, 300)
    : null;
  const advice = sentences
    .filter((sentence) => !sentence.includes('?'))
    .join('')
    .trim();
  return {
    reply: advice || 'Mình cần thêm một chút thông tin để tư vấn phù hợp hơn.',
    followUpQuestion,
  };
}
