import { BadRequestException } from '@nestjs/common';
import { BookingType } from '@prisma/client';

export const MIN_SCHEDULE_LEAD_MS = 60 * 60 * 1000;
export const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

const DAY_BY_NAME: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const VIETNAM_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function resolveOrderTime(
  bookingType: BookingType,
  scheduledAt: string | undefined,
  now = new Date(),
): Date {
  if (bookingType === BookingType.ASAP) {
    if (scheduledAt) {
      throw new BadRequestException('Đơn ASAP không được có scheduledAt.');
    }
    return now;
  }
  if (!scheduledAt) {
    throw new BadRequestException('Đơn đặt lịch phải có scheduledAt.');
  }
  const value = new Date(scheduledAt);
  if (
    !Number.isFinite(value.getTime()) ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(scheduledAt)
  ) {
    throw new BadRequestException(
      'Thời gian phải hợp lệ và có múi giờ (Z hoặc +07:00).',
    );
  }
  const delay = value.getTime() - now.getTime();
  if (delay < MIN_SCHEDULE_LEAD_MS) {
    throw new BadRequestException(
      'Lịch đặt phải cách hiện tại ít nhất 60 phút.',
    );
  }
  if (delay > MAX_SCHEDULE_AHEAD_MS) {
    throw new BadRequestException('Chỉ có thể đặt lịch trước tối đa 30 ngày.');
  }
  return value;
}

export function vietnameseDayAndMinute(date: Date): {
  dayOfWeek: number;
  minuteOfDay: number;
} {
  const parts = VIETNAM_TIME_FORMAT.formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    dayOfWeek: DAY_BY_NAME[value.weekday] ?? -1,
    minuteOfDay: Number(value.hour) * 60 + Number(value.minute),
  };
}

export function assertWithinWorkingHours(
  date: Date,
  durationMinutes: number,
  hours: { dayOfWeek: number; startMinute: number; endMinute: number }[],
): void {
  const { dayOfWeek, minuteOfDay } = vietnameseDayAndMinute(date);
  const fits = hours.some(
    (slot) =>
      slot.dayOfWeek === dayOfWeek &&
      slot.startMinute <= minuteOfDay &&
      minuteOfDay + durationMinutes <= slot.endMinute,
  );
  if (!fits) {
    throw new BadRequestException(
      'Thời gian yêu cầu nằm ngoài lịch làm việc của nhà cung cấp.',
    );
  }
}

export function timeRangesOverlap(
  start: Date,
  durationMinutes: number,
  otherStart: Date,
  otherDurationMinutes: number,
): boolean {
  const end = start.getTime() + durationMinutes * 60_000;
  const otherEnd = otherStart.getTime() + otherDurationMinutes * 60_000;
  return start.getTime() < otherEnd && otherStart.getTime() < end;
}
