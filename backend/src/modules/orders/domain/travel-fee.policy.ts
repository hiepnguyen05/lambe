import { BadRequestException } from '@nestjs/common';

export function estimateTravelDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0)
    throw new BadRequestException('Khoảng cách không hợp lệ.');
  return Math.ceil(distanceKm * 15 - 1e-9) / 10;
}

export function calculateTravelFee(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0)
    throw new BadRequestException('Khoảng cách không hợp lệ.');

  const km = Math.ceil(distanceKm * 10 - 1e-9) / 10;
  const amount =
    Math.max(0, Math.min(km, 5) - 2) * 4000 +
    Math.max(0, Math.min(km, 10) - 5) * 6000 +
    Math.max(0, km - 10) * 8000;
  return Math.ceil(amount / 1000) * 1000;
}
