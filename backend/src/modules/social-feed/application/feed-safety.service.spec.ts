import { feedSafetySignals } from './feed-safety.service';
import { feedMediaUrl } from './feed-media-url';
describe('Feed safety boundaries', () => {
  it('normalizes Vietnamese claims and treats findings as review signals', () => {
    expect(
      feedSafetySignals('Cam kết trị mụn vĩnh viễn 100%, không tác dụng phụ')
        .labels,
    ).toContain('MEDICAL_CLAIM');
    expect(feedSafetySignals('Tóc mới cho buổi hẹn')).toEqual({
      score: 0,
      labels: [],
    });
  });
  it('requires a signer for authenticated assets instead of returning a public URL', () => {
    expect(() =>
      feedMediaUrl({
        secureUrl: 'https://example.test/public',
        kind: 'VIDEO',
        deliveryType: 'authenticated',
        publicId: 'video',
        format: 'mp4',
      }),
    ).toThrow();
  });
});
