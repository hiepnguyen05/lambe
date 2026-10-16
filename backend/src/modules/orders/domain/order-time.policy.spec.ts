import { BadRequestException } from '@nestjs/common';
import { BookingType } from '@prisma/client';
import {
  assertWithinWorkingHours,
  MAX_SCHEDULE_AHEAD_MS,
  MIN_SCHEDULE_LEAD_MS,
  resolveOrderTime,
  timeRangesOverlap,
  vietnameseDayAndMinute,
} from './order-time.policy';

describe('order-time policy', () => {
  const now = new Date('2026-10-09T08:00:00.000Z');

  it('uses current time for ASAP orders', () => {
    expect(resolveOrderTime(BookingType.ASAP, undefined, now)).toEqual(now);
  });

  it('does not accept scheduledAt for ASAP orders', () => {
    expect(() =>
      resolveOrderTime(BookingType.ASAP, '2026-10-09T11:00:00.000Z', now),
    ).toThrow(BadRequestException);
  });

  it('requires scheduled orders to be between 60 minutes and 30 days ahead', () => {
    expect(() =>
      resolveOrderTime(
        BookingType.SCHEDULED,
        new Date(now.getTime() + MIN_SCHEDULE_LEAD_MS - 1).toISOString(),
        now,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveOrderTime(
        BookingType.SCHEDULED,
        new Date(now.getTime() + MAX_SCHEDULE_AHEAD_MS + 1).toISOString(),
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('interprets working hours in Vietnam time', () => {
    const serviceTime = new Date('2026-10-09T11:00:00.000Z');
    expect(vietnameseDayAndMinute(serviceTime)).toEqual({
      dayOfWeek: 5,
      minuteOfDay: 18 * 60,
    });
    expect(() =>
      assertWithinWorkingHours(serviceTime, 60, [
        { dayOfWeek: 5, startMinute: 17 * 60, endMinute: 20 * 60 },
      ]),
    ).not.toThrow();
  });

  it('rejects a service that would end after the working slot', () => {
    expect(() =>
      assertWithinWorkingHours(new Date('2026-10-09T12:30:00.000Z'), 60, [
        { dayOfWeek: 5, startMinute: 17 * 60, endMinute: 20 * 60 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('detects overlap but allows adjacent appointments', () => {
    const first = new Date('2026-10-09T11:00:00.000Z');
    expect(
      timeRangesOverlap(first, 60, new Date('2026-10-09T11:30:00.000Z'), 30),
    ).toBe(true);
    expect(
      timeRangesOverlap(first, 60, new Date('2026-10-09T12:00:00.000Z'), 30),
    ).toBe(false);
  });
});
