import { assertWorkingHoursValid } from './provider-setup.policy';

describe('Provider working hours', () => {
  it.each([
    [{ dayOfWeek: 1, startMinute: 900, endMinute: 800 }],
    [{ dayOfWeek: 1, startMinute: 800, endMinute: 800 }],
    [
      { dayOfWeek: 1, startMinute: 480, endMinute: 900 },
      { dayOfWeek: 1, startMinute: 850, endMinute: 1000 },
    ],
  ])('rejects inverted or overlapping hours', (...slots) => {
    expect(() => assertWorkingHoursValid(slots)).toThrow();
  });
  it('accepts adjacent slots and independent days without mutating input', () => {
    const slots = [
      { dayOfWeek: 2, startMinute: 480, endMinute: 900 },
      { dayOfWeek: 1, startMinute: 900, endMinute: 1000 },
      { dayOfWeek: 1, startMinute: 480, endMinute: 900 },
    ];
    const copy = slots.map((slot) => ({ ...slot }));
    expect(() => assertWorkingHoursValid(slots)).not.toThrow();
    expect(slots).toEqual(copy);
  });
});
