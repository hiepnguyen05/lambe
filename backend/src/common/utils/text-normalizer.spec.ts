import { normalizeName, trimOptionalField } from './text-normalizer';

describe('text normalizer', () => {
  it('normalizes Vietnamese names for uniqueness checks', () => {
    expect(normalizeName('  Cắt   tóc Đẹp  ')).toBe('cat toc dep');
  });

  it('keeps the current nullable-field behavior', () => {
    expect(trimOptionalField(undefined)).toBeNull();
    expect(trimOptionalField(null)).toBeNull();
    expect(trimOptionalField('  ')).toBe('');
  });
});
