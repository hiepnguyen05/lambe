import {
  assessSlot,
  suggestSlots,
  transitionMinutes,
  type BusyInterval,
} from './booking-calendar.policy';

describe('booking calendar algorithm', () => {
  const point = { latitude: 21.028, longitude: 105.834 };
  const date = (time: string) => new Date(`2026-10-12T${time}:00+07:00`);
  const hours = [{ dayOfWeek: 1, startMinute: 8 * 60, endMinute: 20 * 60 }];
  const block = (start: string, end: string): BusyInterval => ({
    startAt: date(start),
    endAt: date(end),
    point,
  });
  const input = {
    point,
    hours,
    durationMinutes: 60,
    startAt: date('13:00'),
    blocks: [block('14:00', '15:00')],
  };

  it('protects travel and preparation time before a 14:00 appointment', () => {
    expect(assessSlot(input).available).toBe(false);
    expect(assessSlot({ ...input, startAt: date('12:30') }).available).toBe(
      true,
    );
  });
  it('does not let a future appointment block the entire morning', () => {
    expect(
      assessSlot({
        ...input,
        startAt: date('09:30'),
        reservationStartAt: date('09:00'),
      }).available,
    ).toBe(true);
  });
  it('cannot place an appointment inside a long-running block', () => {
    expect(
      assessSlot({ ...input, blocks: [block('08:00', '18:00')] }).available,
    ).toBe(false);
  });
  it('checks both neighbours and suggests times only after all conflicts', () => {
    const slots = suggestSlots({
      ...input,
      until: date('20:00'),
      limit: 3,
      blocks: [block('12:00', '13:30'), block('14:00', '15:00')],
    });
    expect(slots[0].startAt).toEqual(date('15:30'));
    for (const slot of slots)
      expect(
        assessSlot({
          ...input,
          startAt: slot.startAt,
          blocks: [block('12:00', '13:30'), block('14:00', '15:00')],
        }).available,
      ).toBe(true);
  });
  it('rejects an appointment that ends outside working hours or during lunch', () => {
    expect(
      assessSlot({ ...input, startAt: date('19:30'), blocks: [] }).reason,
    ).toBe('OUTSIDE_WORKING_HOURS');
    expect(
      assessSlot({
        ...input,
        hours: [
          { dayOfWeek: 1, startMinute: 8 * 60, endMinute: 12 * 60 },
          { dayOfWeek: 1, startMinute: 14 * 60, endMinute: 20 * 60 },
        ],
        blocks: [],
      }).available,
    ).toBe(false);
  });
  it('marks suggestions based on a running job as estimated', () => {
    const slots = suggestSlots({
      ...input,
      blocks: [{ ...block('11:00', '13:00'), estimated: true }],
      until: date('20:00'),
      limit: 1,
    });
    expect(slots[0]).toMatchObject({
      startAt: date('13:30'),
      availability: 'ESTIMATED',
      requiresProviderConfirmation: true,
    });
  });
  it('applies increasing travel buffers for more distant customers', () => {
    expect(
      transitionMinutes(point, { ...point, longitude: point.longitude + 0.1 }),
    ).toBeGreaterThan(transitionMinutes(point, point));
  });
  it('handles the first and last gap even when there are no appointments', () => {
    expect(
      suggestSlots({
        ...input,
        blocks: [],
        startAt: date('07:00'),
        until: date('20:00'),
        limit: 1,
      })[0].startAt,
    ).toEqual(date('08:00'));
    expect(
      suggestSlots({
        ...input,
        blocks: [block('08:00', '12:00')],
        until: date('20:00'),
        limit: 1,
      })[0].startAt,
    ).toEqual(date('13:00'));
  });
  it('matches exhaustive 15-minute search across deterministic randomized calendars', () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let run = 0; run < 100; run++) {
      const blocks = Array.from({ length: 5 }, () => {
        const startAt = new Date(
          date('08:00').getTime() + Math.floor(random() * 40) * 15 * 60000,
        );
        return {
          startAt,
          endAt: new Date(
            startAt.getTime() + (15 + Math.floor(random() * 90)) * 60000,
          ),
          point,
        };
      });
      const query = {
        ...input,
        blocks,
        startAt: date('08:00'),
        until: date('20:00'),
        limit: 48,
      };
      const expected: number[] = [];
      for (
        let time = date('08:00').getTime();
        time + 3600000 <= date('20:00').getTime();
        time += 15 * 60000
      ) {
        if (assessSlot({ ...query, startAt: new Date(time) }).available)
          expected.push(time);
      }
      expect(suggestSlots(query).map((slot) => slot.startAt.getTime())).toEqual(
        expected,
      );
    }
  });
});
