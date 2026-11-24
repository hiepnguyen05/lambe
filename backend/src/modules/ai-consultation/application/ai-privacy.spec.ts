import {
  containsUnsupportedClaim,
  isClearlyOutOfScope,
  redactForGemini,
  safeConsultationAdvice,
} from './ai-privacy';

describe('AI consultation boundaries', () => {
  it.each([
    '123 Lê Lợi, Phường 1, Quận 3',
    'Mình ở 14/2 Nguyễn Trãi và muốn cắt tóc',
    'Căn hộ 502, tòa B',
    'addressLine: 22 P. Trần Hưng Đạo. Quận 1',
    'vĩ độ: -21.02 kinh độ: 105.8',
    'lat=21.02 lng=105.8',
    'https://example.test/kyc/private?token=secret',
    'CCCD AB1234567',
    'OTP: 123456',
    'fullName: Nguyen Van A',
  ])('does not forward recognized private data: %s', (text) => {
    const redacted = redactForGemini(text);
    expect(redacted).not.toBe(text);
    expect(redacted).not.toMatch(
      /123 Lê Lợi|Nguyễn Trãi|502|Trần Hưng|21\.02|105\.8|token=|AB1234567|123456|Nguyen Van/,
    );
  });
  it.each([
    'Side Part 6/4, tóc mái dài 6 cm',
    'Tóc 2-3 cm, nhuộm nâu lạnh',
    'Da nhạy cảm, makeup tone hồng',
  ])('preserves useful beauty detail: %s', (text) => {
    expect(redactForGemini(text)).toBe(text);
    expect(containsUnsupportedClaim(text)).toBe(false);
  });
  it('keeps useful advice while removing commercial sentences including obfuscated claims', () => {
    expect(
      safeConsultationAdvice(
        'Bạn có thể thử Side Part. Giá chỉ ba trăm nghìn đồng. Salon A còn lịch.',
      ),
    ).toBe('Bạn có thể thử Side Part.');
    expect(containsUnsupportedClaim('G\u200biá ９９k')).toBe(true);
    expect(containsUnsupportedClaim('Dùng coupon MIENPHI')).toBe(true);
  });
  it('removes labelled contact, identity, location and address data before Gemini', () => {
    const text = redactForGemini(
      'Email an@example.com, sdt 0912345678, CCCD 012345678901, GPS 10.7731,106.7030; địa chỉ: 12 Nguyễn Trãi, Quận 1',
    );
    for (const secret of [
      'an@example.com',
      '0912345678',
      '012345678901',
      '10.7731',
      '106.7030',
      '12 Nguyễn Trãi',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it.each([
    'Tôi có nên nuôi mèo?',
    'Mai ăn gì?',
    'Thời tiết hôm nay?',
    'Giúp tôi lập trình một app',
  ])('recognizes an obviously unrelated topic: %s', (text) =>
    expect(isClearlyOutOfScope(text)).toBe(true),
  );

  it.each([
    'Tóc Side Part với mái dài 6 cm.',
    'Chọn nail màu nude.',
    'Makeup nhẹ đi date.',
    'Massage thư giãn.',
    'Chăm sóc da nhạy cảm.',
  ])('keeps beauty consultation in scope: %s', (text) =>
    expect(isClearlyOutOfScope(text)).toBe(false),
  );

  it.each([
    'Giá 99k.',
    'Chỉ 100.000 đồng.',
    'Cách bạn 2.5 km.',
    'Thợ này còn lịch lúc 18h.',
    'Dùng voucher ABC.',
  ])('does not trust operational claims from the model: %s', (text) =>
    expect(containsUnsupportedClaim(text)).toBe(true),
  );
});
