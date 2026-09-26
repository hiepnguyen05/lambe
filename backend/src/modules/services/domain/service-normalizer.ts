export function normalizeServiceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function trimOptionalServiceField(
  value: string | null | undefined,
): string | null {
  return value == null ? null : value.trim();
}
