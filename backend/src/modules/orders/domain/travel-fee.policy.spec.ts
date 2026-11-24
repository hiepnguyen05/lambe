import { calculateTravelFee } from './travel-fee.policy';

describe('travel fee policy', () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 4000],
    [5, 12000],
    [6, 18000],
    [7, 24000],
    [10, 42000],
    [12, 58000],
    [6.24, 20000],
  ])('charges %s km as %s VND', (kilometers, expected) => {
    expect(calculateTravelFee(kilometers)).toBe(expected);
  });

  it('rejects invalid distances', () => {
    expect(() => calculateTravelFee(Number.NaN)).toThrow();
    expect(() => calculateTravelFee(-1)).toThrow();
  });
});
