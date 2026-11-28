import { calculateDistanceKm } from '../../discovery/domain/distance';
import { vietnameseDayAndMinute } from './order-time.policy';

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const SLOT_MINUTES = 15;
export const PREPARATION_MINUTES = 10;
export const SAFETY_MINUTES = 15;
export const PROVIDER_RESPONSE_TIMEOUT_SECONDS = 30;
export const PROVIDER_RESPONSE_TIMEOUT_MS =
  PROVIDER_RESPONSE_TIMEOUT_SECONDS * 1000;
export const ASAP_RESPONSE_MINUTES = 1;
export const SCHEDULE_RESPONSE_MINUTES = 30;
export const DEPARTURE_LEAD_MINUTES = 60;
export const SCHEDULE_LEAD_MINUTES = 60;
export const OVERRUN_MINUTES = 30;

export interface Point {
  latitude: number;
  longitude: number;
}
export interface WorkingHour {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}
export interface BusyInterval {
  startAt: Date;
  endAt: Date;
  point?: Point;
  estimated?: boolean;
  executing?: boolean;
}
export interface SlotInput {
  startAt: Date;
  durationMinutes: number;
  point: Point;
  hours: WorkingHour[];
  blocks: BusyInterval[];
  reservationStartAt?: Date;
}

// Conservative fallback, not a road-route ETA. Kept pure so a routing adapter can replace it.
export function travelMinutes(distanceKm: number): number {
  return Math.ceil(((distanceKm * 1.5) / 20) * 60);
}

export function transitionMinutes(from?: Point, to?: Point): number {
  return from && to
    ? travelMinutes(calculateDistanceKm(from, to)) +
        PREPARATION_MINUTES +
        SAFETY_MINUTES
    : 0;
}

export function fitsWorkingHours(
  startAt: Date,
  durationMinutes: number,
  hours: WorkingHour[],
): boolean {
  const { dayOfWeek, minuteOfDay } = vietnameseDayAndMinute(startAt);
  const fractionalMinute =
    minuteOfDay +
    startAt.getUTCSeconds() / 60 +
    startAt.getUTCMilliseconds() / MINUTE;
  return hours.some(
    (hour) =>
      hour.dayOfWeek === dayOfWeek &&
      hour.startMinute <= fractionalMinute &&
      fractionalMinute + durationMinutes <= hour.endMinute,
  );
}

export function assessSlot(input: SlotInput): {
  available: boolean;
  reason: string | null;
  estimated: boolean;
} {
  const end = input.startAt.getTime() + input.durationMinutes * MINUTE;
  const start = (input.reservationStartAt ?? input.startAt).getTime();
  if (!fitsWorkingHours(input.startAt, input.durationMinutes, input.hours)) {
    return {
      available: false,
      reason: 'OUTSIDE_WORKING_HOURS',
      estimated: false,
    };
  }
  let estimated = false;
  for (const block of input.blocks) {
    const before =
      block.endAt.getTime() +
        transitionMinutes(block.point, input.point) * MINUTE <=
      start;
    const after =
      end + transitionMinutes(input.point, block.point) * MINUTE <=
      block.startAt.getTime();
    if (!before && !after)
      return {
        available: false,
        reason: 'PROVIDER_TIME_CONFLICT',
        estimated: !!block.estimated,
      };
    if (before && block.estimated) estimated = true;
  }
  return { available: true, reason: null, estimated };
}

// Prepare travel buffers once, then sweep forward through gaps: O(B log B + slots).
export function suggestSlots(
  input: Omit<SlotInput, 'reservationStartAt'> & { until: Date; limit: number },
) {
  const result: {
    startAt: Date;
    endAt: Date;
    availability: 'AVAILABLE' | 'ESTIMATED';
    requiresProviderConfirmation: true;
  }[] = [];
  let cursor =
    Math.ceil(input.startAt.getTime() / (SLOT_MINUTES * MINUTE)) *
    SLOT_MINUTES *
    MINUTE;
  const ranges = input.blocks
    .map((block) => {
      const buffer = transitionMinutes(block.point, input.point) * MINUTE;
      return {
        start: block.startAt.getTime() - buffer,
        end: block.endAt.getTime() + buffer,
        estimated: block.estimated,
      };
    })
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  let estimatedAfter = Infinity;
  for (const range of ranges) {
    if (range.estimated) estimatedAfter = Math.min(estimatedAfter, range.end);
    const last = merged.at(-1);
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ start: range.start, end: range.end });
  }
  let index = 0;
  while (
    cursor + input.durationMinutes * MINUTE <= input.until.getTime() &&
    result.length < input.limit
  ) {
    while (index < merged.length && merged[index].end <= cursor) index++;
    const conflict = merged[index];
    if (conflict && conflict.start < cursor + input.durationMinutes * MINUTE) {
      cursor =
        Math.ceil(conflict.end / (SLOT_MINUTES * MINUTE)) *
        SLOT_MINUTES *
        MINUTE;
      continue;
    }
    const startAt = new Date(cursor);
    if (fitsWorkingHours(startAt, input.durationMinutes, input.hours)) {
      result.push({
        startAt,
        endAt: new Date(cursor + input.durationMinutes * MINUTE),
        availability: cursor >= estimatedAfter ? 'ESTIMATED' : 'AVAILABLE',
        requiresProviderConfirmation: true,
      });
    }
    cursor += SLOT_MINUTES * MINUTE;
  }
  return result;
}
