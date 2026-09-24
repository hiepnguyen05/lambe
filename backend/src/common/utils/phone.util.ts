export function normalizeVietnamesePhone(phone: string): string {
  const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');

  if (cleanPhone.startsWith('+84')) {
    return `0${cleanPhone.substring(3)}`;
  }

  if (cleanPhone.startsWith('84') && cleanPhone.length > 9) {
    return `0${cleanPhone.substring(2)}`;
  }

  return cleanPhone;
}
