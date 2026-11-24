import { useState } from 'react';
import {
  Scissors,
  Flame,
  Palette,
  Brush,
  Paintbrush,
  Flower2,
  Smile,
  Sparkles,
  Droplets,
  Bath,
  Wand2,
  Eye,
  Heart,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calendar,
  Star,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

const LUCIDE_MAP: Record<string, LucideIcon> = {
  // Nhóm tóc, cắt tỉa & salon
  scissors: Scissors,
  content_cut: Scissors,
  cut: Scissors,
  hair: Scissors,

  // Nhóm nhiệt, uốn tóc, sấy
  flame: Flame,
  heat: Flame,
  fire: Flame,
  air: Flame,
  airwave: Flame,

  // Nhóm nhuộm tóc & bảng màu
  palette: Palette,
  color: Palette,

  // Nhóm làm móng & cọ vẽ
  brush: Brush,
  paintbrush: Paintbrush,
  nail: Brush,

  // Nhóm spa, hoa & thư giãn
  'flower-2': Flower2,
  flower_2: Flower2,
  flower: Flower2,
  spa: Flower2,
  self_improvement: Flower2,
  local_florist: Flower2,

  // Nhóm chăm sóc da & khuôn mặt
  smile: Smile,
  face: Smile,
  face_3: Smile,
  face_4: Smile,
  face_6: Smile,

  // Nhóm trang điểm, combo & làm đẹp
  sparkles: Sparkles,
  sparkle: Sparkles,
  face_retouching_natural: Sparkles,
  auto_awesome: Sparkles,
  health_and_beauty: Sparkles,
  cheer: Sparkles,
  menu: Sparkles,

  // Nhóm gội đầu, nước & vệ sinh
  droplets: Droplets,
  droplet: Droplets,
  wash: Droplets,
  water_drop: Droplets,
  bath: Bath,
  shower: Bath,

  // Nhóm tẩy tóc & nâng tone
  'wand-2': Wand2,
  wand_2: Wand2,
  wand: Wand2,
  cleaning_services: Wand2,

  // Nhóm mắt, nối mi
  eye: Eye,
  visibility: Eye,

  // Nhóm môi, phun xăm thẩm mỹ
  heart: Heart,
  lips: Heart,
  lip: Heart,

  // Nhóm an toàn & chứng nhận
  'shield-check': ShieldCheck,
  shield_check: ShieldCheck,
  shield: ShieldCheck,
  verified: CheckCircle2,
  check_circle: CheckCircle2,

  // Đồng hồ & Lịch
  clock: Clock,
  schedule: Clock,
  calendar: Calendar,
  star: Star,
  'layout-grid': LayoutGrid,
  layout_grid: LayoutGrid,
  category: LayoutGrid,
};

export interface LambeIconProps {
  nameOrUrl?: string | null;
  className?: string;
  imgClassName?: string;
  size?: number;
  fallbackName?: string;
}

export function LambeIcon({
  nameOrUrl,
  className = 'w-5 h-5',
  imgClassName,
  size,
  fallbackName,
}: LambeIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!nameOrUrl) {
    return <Sparkles className={className} size={size} />;
  }

  const trimmed = nameOrUrl.trim();

  // 1. Nếu là URL ảnh hoặc vector SVG từ CDN / Cloudinary
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let cleanUrl = trimmed;
    let fallback = fallbackName;
    const hashIndex = trimmed.indexOf('#');
    if (hashIndex !== -1) {
      cleanUrl = trimmed.substring(0, hashIndex);
      const hash = trimmed.substring(hashIndex + 1);
      const match = hash.match(/fallback=([a-zA-Z0-9_-]+)/);
      if (match) {
        fallback = match[1];
      }
    }

    if (failedUrl !== cleanUrl) {
      return (
        <img
          src={cleanUrl}
          alt="icon"
          className={imgClassName || 'w-full h-full object-cover block'}
          style={size && !imgClassName ? { width: size, height: size } : undefined}
          onError={() => setFailedUrl(cleanUrl)}
        />
      );
    }

    // Khi ảnh bị lỗi, hiển thị mã icon dự phòng
    const fallbackKey = (fallback || 'sparkles').toLowerCase().replace(/ /g, '_');
    const FallbackComponent = LUCIDE_MAP[fallbackKey] || Sparkles;
    return <FallbackComponent className={className} size={size} />;
  }

  // 2. Nếu là mã Icon chuẩn Lucide / Legacy
  const key = trimmed.toLowerCase().replace(/ /g, '_');
  const IconComponent = LUCIDE_MAP[key] || Sparkles;

  return <IconComponent className={className} size={size} />;
}

