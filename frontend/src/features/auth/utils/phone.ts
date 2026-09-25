export const VIETNAMESE_PHONE_PATTERN = /^(?:\+84|84|0)[35789][0-9]{8}$/

export function normalizeNationalPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('84') && digits.length > 9) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)

  return digits.slice(0, 9)
}

export function toVietnamesePhone(value: string): string {
  return `0${normalizeNationalPhoneInput(value)}`
}

export function formatNationalPhone(value: string): string {
  return normalizeNationalPhoneInput(value)
    .replace(/(\d{3})(?=\d)/g, '$1 ')
    .trim()
}

export function formatInternationalPhone(value: string): string {
  return `+84 ${formatNationalPhone(value)}`.trim()
}
