export const VIETNAMESE_PHONE_PATTERN = /^(?:\+84|84|0)[35789][0-9]{8}$/;

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeNationalPhoneInput(value: string) {
  const digits = digitsOnly(value);
  if (digits.startsWith('84')) return digits.slice(2, 11);
  if (digits.startsWith('0')) return digits.slice(1, 10);
  return digits.slice(0, 9);
}

export function toVietnamesePhone(value: string) {
  return `0${normalizeNationalPhoneInput(value)}`;
}

export function toE164VietnamesePhone(value: string) {
  return `+84${normalizeNationalPhoneInput(value)}`;
}

export function formatNationalPhone(value: string) {
  const national = normalizeNationalPhoneInput(value);
  return national.replace(/^(\d{3})(\d{3})(\d{0,3}).*$/, (_, a, b, c) =>
    [a, b, c].filter(Boolean).join(' '),
  );
}

export function formatInternationalPhone(value: string) {
  const formatted = formatNationalPhone(value);
  return formatted ? `+84 ${formatted}` : '+84';
}
