import {
  normalizeCode,
  normalizeSlug,
  trimOptionalString,
  trimString,
} from './string-transformers';

describe('string transformers', () => {
  it('normalizes codes and slugs without changing non-string input', () => {
    expect(normalizeCode({ value: ' hair_care ' })).toBe('HAIR_CARE');
    expect(normalizeSlug({ value: ' HAIR-CARE ' })).toBe('hair-care');
    expect(normalizeCode({ value: 42 })).toBe(42);
    expect(normalizeSlug({ value: null })).toBeNull();
  });

  it('trims required and optional strings differently', () => {
    expect(trimString({ value: '  ' })).toBe('');
    expect(trimOptionalString({ value: '  ' })).toBeNull();
    expect(trimOptionalString({ value: undefined })).toBeUndefined();
  });
});
