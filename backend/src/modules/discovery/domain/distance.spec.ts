import { calculateDistanceKm } from './distance';

describe('calculateDistanceKm', () => {
  it('returns zero for the same point', () => {
    expect(
      calculateDistanceKm(
        { latitude: 10.7731, longitude: 106.703 },
        { latitude: 10.7731, longitude: 106.703 },
      ),
    ).toBe(0);
  });

  it('calculates a realistic distance between two nearby points', () => {
    const distance = calculateDistanceKm(
      { latitude: 10.7731, longitude: 106.703 },
      { latitude: 10.7769, longitude: 106.7009 },
    );
    expect(distance).toBeGreaterThan(0.4);
    expect(distance).toBeLessThan(0.6);
  });
});
