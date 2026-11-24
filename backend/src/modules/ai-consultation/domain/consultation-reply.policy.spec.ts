import { normalizeConsultationText } from './consultation-reply.policy';

describe('consultation reply policy', () => {
  it('renders a repeated model question only once', () => {
    expect(
      normalizeConsultationText(
        'Bạn có thể thử Side Part. Tóc hiện dài bao nhiêu?',
        'Tóc hiện dài bao nhiêu?',
      ),
    ).toEqual({
      reply: 'Bạn có thể thử Side Part.',
      followUpQuestion: 'Tóc hiện dài bao nhiêu?',
    });
  });

  it('keeps at most one question even when both model fields contain several', () => {
    const result = normalizeConsultationText(
      'Màu nude phù hợp. Bạn thích màu nào? Bạn muốn kiểu gì?',
      'Bạn thích màu nào? Bạn muốn kiểu gì?',
    );
    expect(result.reply).toBe('Màu nude phù hợp.');
    expect(result.followUpQuestion).toBe('Bạn thích màu nào?');
  });

  it('preserves useful advice without a question', () => {
    expect(
      normalizeConsultationText('Textured Crop tạo độ phồng tự nhiên.'),
    ).toEqual({
      reply: 'Textured Crop tạo độ phồng tự nhiên.',
      followUpQuestion: null,
    });
  });
});
