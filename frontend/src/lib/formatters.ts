/**
 * Shared formatting utilities for Admin Console
 */

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

export function formatDateOnly(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
  }).format(new Date(dateStr));
}

