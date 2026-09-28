import { BadRequestException } from '@nestjs/common';

export function assertProviderAdult(birthDate: Date, now = new Date()): void {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const component = (name: string) =>
    Number(parts.find((part) => part.type === name)?.value);
  const year = component('year');
  const month = component('month') - 1;
  const day = component('day');
  let age = year - birthDate.getUTCFullYear();
  if (
    month < birthDate.getUTCMonth() ||
    (month === birthDate.getUTCMonth() && day < birthDate.getUTCDate())
  )
    age--;
  if (!Number.isFinite(birthDate.getTime()) || age < 18) {
    throw new BadRequestException('Người đăng ký đối tác phải đủ 18 tuổi.');
  }
}

export function parseProviderBirthDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Ngày sinh phải có định dạng YYYY-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Ngày sinh không hợp lệ.');
  }
  assertProviderAdult(date);
  return date;
}
