export const commonCatalogIcons = [
  { name: 'scissors', label: 'Cắt tóc' },
  { name: 'flame', label: 'Uốn / Tạo kiểu' },
  { name: 'flower_2', label: 'Spa & Massage' },
  { name: 'brush', label: 'Làm móng / Cọ' },
  { name: 'palette', label: 'Nhuộm / Màu' },
  { name: 'droplets', label: 'Gội đầu / Nước' },
  { name: 'smile', label: 'Chăm sóc da' },
  { name: 'sparkles', label: 'Trang điểm / Combo' },
  { name: 'eye', label: 'Nối mi' },
  { name: 'heart', label: 'Phun xăm' },
  { name: 'wand_2', label: 'Tẩy tóc' },
  { name: 'bath', label: 'Tắm / Vệ sinh' },
  { name: 'shield_check', label: 'Y tế / Vô trùng' },
  { name: 'star', label: 'Nổi bật' },
  { name: 'layout_grid', label: 'Mặc định' },
] as const;

function withoutVietnameseMarks(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
}

export function generateCatalogSlug(text: string) {
  return withoutVietnameseMarks(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function generateCatalogCode(text: string) {
  return withoutVietnameseMarks(text)
    .toUpperCase()
    .replace(/[^A-Z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50)
}

export function parseIconValue(rawIconUrl?: string | null): { iconCode: string; iconImageUrl: string } {
  if (!rawIconUrl) return { iconCode: 'layout_grid', iconImageUrl: '' };
  const trimmed = rawIconUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const hashIndex = trimmed.indexOf('#');
    if (hashIndex !== -1) {
      const iconImageUrl = trimmed.substring(0, hashIndex);
      const hash = trimmed.substring(hashIndex + 1);
      const match = hash.match(/fallback=([a-zA-Z0-9_-]+)/);
      return {
        iconCode: match ? match[1].replace(/-/g, '_') : 'sparkles',
        iconImageUrl,
      };
    }
    return { iconCode: 'sparkles', iconImageUrl: trimmed };
  }
  return { iconCode: trimmed.replace(/-/g, '_'), iconImageUrl: '' };
}

export function buildIconValue(iconCode: string, iconImageUrl: string): string {
  const code = iconCode.trim().replace(/-/g, '_') || 'sparkles';
  const img = iconImageUrl.trim();
  if (img) {
    return `${img}#fallback=${code}`;
  }
  return code;
}
