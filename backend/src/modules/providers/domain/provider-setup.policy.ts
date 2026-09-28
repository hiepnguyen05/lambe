import { BadRequestException } from '@nestjs/common';

export function assertWorkingHoursValid(
  hours: { dayOfWeek: number; startMinute: number; endMinute: number }[],
): void {
  const sorted = [...hours].sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek || left.startMinute - right.startMinute,
  );
  for (let index = 0; index < sorted.length; index++) {
    const slot = sorted[index];
    const previous = sorted[index - 1];
    if (slot.endMinute <= slot.startMinute)
      throw new BadRequestException(
        'Giờ kết thúc phải sau giờ bắt đầu. Ca qua đêm phải tách thành hai ngày.',
      );
    if (
      previous &&
      previous.dayOfWeek === slot.dayOfWeek &&
      slot.startMinute < previous.endMinute
    )
      throw new BadRequestException(
        'Các khung giờ trong cùng ngày không được chồng lấn.',
      );
  }
}
