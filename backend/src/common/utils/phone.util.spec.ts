import { normalizeVietnamesePhone } from './phone.util';

describe('normalizeVietnamesePhone', () => {
  it.each([
    ['+84363668951', '0363668951'],
    ['84363668951', '0363668951'],
    ['0363668951', '0363668951'],
    [' 036 366-8951 ', '0363668951'],
    ['(036)3668951', '0363668951'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeVietnamesePhone(input)).toBe(expected);
  });

  it('leaves an unrelated value unchanged for the validation layer to reject', () => {
    expect(normalizeVietnamesePhone('invalid')).toBe('invalid');
  });
});
