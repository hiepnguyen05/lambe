export const commonCatalogIcons = [
  { name: 'content_cut', label: 'Cắt tóc' },
  { name: 'spa', label: 'Spa & Massage' },
  { name: 'face', label: 'Chăm sóc da' },
  { name: 'face_retouching_natural', label: 'Trang điểm' },
  { name: 'brush', label: 'Làm móng / Cọ' },
  { name: 'palette', label: 'Nhuộm / Màu' },
  { name: 'wash', label: 'Gội đầu' },
  { name: 'healing', label: 'Trị liệu' },
  { name: 'local_florist', label: 'Thảo mộc' },
  { name: 'clean_hands', label: 'Vệ sinh' },
  { name: 'health_and_safety', label: 'Phòng khám' },
  { name: 'self_improvement', label: 'Thư giãn' },
  { name: 'favorite', label: 'Yêu thích' },
  { name: 'star', label: 'Nổi bật' },
  { name: 'category', label: 'Mặc định' },
] as const

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
