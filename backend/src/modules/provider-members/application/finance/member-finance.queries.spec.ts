import { financeNumber, netOrderProceeds } from './member-finance.queries';

describe('organization finance integer precision', () => {
  it('serializes PostgreSQL bigint only when exactly representable in JSON numbers', () => {
    expect(financeNumber('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => financeNumber(9007199254740992n)).toThrow();
    expect(() => financeNumber('1.5')).toThrow();
  });

  it('keeps net proceeds exact even if an intermediate sum exceeds safe integer range', () => {
    expect(
      netOrderProceeds(Number.MAX_SAFE_INTEGER, 2, Number.MAX_SAFE_INTEGER),
    ).toBe(2);
    expect(netOrderProceeds(130000, 30000n, 15000n)).toBe(145000);
    expect(netOrderProceeds(0, 0, 0)).toBe(0);
    expect(() => netOrderProceeds(Number.MAX_SAFE_INTEGER, 1, 0)).toThrow();
  });
});
