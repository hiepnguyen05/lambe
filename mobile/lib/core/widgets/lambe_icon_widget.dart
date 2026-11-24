import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Helper ánh xạ tên mã icon (hỗ trợ cả chuẩn Lucide Icons hiện đại và mã Google cũ)
/// sang [IconData] vector cao cấp chuẩn hoá của [LucideIcons].
class LucideIconMapper {
  LucideIconMapper._();

  static const Map<String, IconData> _iconMap = {
    // Nhóm tóc, cắt tỉa & salon
    'scissors': LucideIcons.scissors,
    'content_cut': LucideIcons.scissors,
    'cut': LucideIcons.scissors,
    'hair': LucideIcons.scissors,

    // Nhóm nhiệt, uốn tóc, sấy & tạo kiểu
    'flame': LucideIcons.flame,
    'heat': LucideIcons.flame,
    'fire': LucideIcons.flame,
    'wind': LucideIcons.wind,
    'air': LucideIcons.wind,
    'airwave': LucideIcons.wind,

    // Nhóm nhuộm tóc & bảng màu
    'palette': LucideIcons.palette,
    'color': LucideIcons.palette,
    'colorize': LucideIcons.palette,

    // Nhóm làm móng & cọ vẽ
    'brush': LucideIcons.brush,
    'paintbrush': LucideIcons.paintbrush,
    'nail': LucideIcons.brush,
    'draw': LucideIcons.penTool,

    // Nhóm spa, hoa & thư giãn
    'flower_2': LucideIcons.flower2,
    'flower2': LucideIcons.flower2,
    'flower': LucideIcons.flower,
    'spa': LucideIcons.flower2,
    'self_improvement': LucideIcons.flower2,
    'local_florist': LucideIcons.flower2,
    'healing': LucideIcons.heartPulse,

    // Nhóm chăm sóc da & khuôn mặt
    'smile': LucideIcons.smile,
    'face': LucideIcons.smile,
    'face_3': LucideIcons.smile,
    'face_4': LucideIcons.smile,
    'face_6': LucideIcons.smile,

    // Nhóm trang điểm, combo & làm đẹp cao cấp
    'sparkles': LucideIcons.sparkles,
    'sparkle': LucideIcons.sparkles,
    'face_retouching_natural': LucideIcons.sparkles,
    'auto_awesome': LucideIcons.sparkles,
    'health_and_beauty': LucideIcons.sparkles,
    'makeup': LucideIcons.sparkles,
    'cheer': LucideIcons.sparkles,
    'menu': LucideIcons.sparkles,

    // Nhóm gội đầu, nước & vệ sinh
    'droplets': LucideIcons.droplets,
    'droplet': LucideIcons.droplet,
    'wash': LucideIcons.droplets,
    'water_drop': LucideIcons.droplets,
    'shower': LucideIcons.showerHead,
    'shower_head': LucideIcons.showerHead,
    'bath': LucideIcons.bath,
    'bathtub': LucideIcons.bath,
    'soap': LucideIcons.sparkles,

    // Nhóm tẩy tóc & nâng tone
    'wand_2': LucideIcons.wand2,
    'wand2': LucideIcons.wand2,
    'wand': LucideIcons.wand2,
    'cleaning_services': LucideIcons.wand2,

    // Nhóm mắt, nối mi
    'eye': LucideIcons.eye,
    'visibility': LucideIcons.eye,

    // Nhóm môi, tim, phun xăm thẩm mỹ
    'heart': LucideIcons.heart,
    'lips': LucideIcons.heart,
    'lip': LucideIcons.heart,

    // Nhóm y tế, bảo hành, chứng nhận & an toàn
    'shield_check': LucideIcons.shieldCheck,
    'shield': LucideIcons.shield,
    'security': LucideIcons.shield,
    'health_and_safety': LucideIcons.shieldCheck,
    'medical_services': LucideIcons.heartPulse,
    'verified': LucideIcons.checkCircle2,
    'check_circle': LucideIcons.checkCircle2,

    // Nhóm đồng hồ, lịch & danh mục
    'clock': LucideIcons.clock,
    'schedule': LucideIcons.clock,
    'calendar': LucideIcons.calendar,
    'star': LucideIcons.star,
    'layout_grid': LucideIcons.layoutGrid,
    'category': LucideIcons.layoutGrid,
  };

  /// Ánh xạ chuỗi tên icon sang [IconData] chuẩn Lucide.
  /// Hỗ trợ cả kebab-case, snake_case và camelCase.
  static IconData fromString(
    String? iconName, {
    IconData fallback = LucideIcons.sparkles,
  }) {
    if (iconName == null || iconName.trim().isEmpty) {
      return fallback;
    }

    final key = iconName
        .trim()
        .toLowerCase()
        .replaceAll('-', '_')
        .replaceAll(' ', '_');

    return _iconMap[key] ?? fallback;
  }
}

/// Tương thích ngược với tên gọi cũ
typedef MaterialIconMapper = LucideIconMapper;

/// Widget hiển thị icon doanh nghiệp chuẩn đa nền tảng (Enterprise Architecture):
/// 1. Nếu là URL mạng kết thúc bằng `.svg`: Render vector sắc nét qua [SvgPicture.network].
/// 2. Nếu là URL mạng ảnh thông thường: Render qua [CachedNetworkImage].
/// 3. Nếu là file Asset nội bộ (`assets/...`): Render qua [SvgPicture.asset] hoặc [Image.asset].
/// 4. Nếu là mã Icon chuẩn (VD: 'scissors', 'flame', 'flower-2', 'brush'):
///    Render vector chuẩn hóa bằng bộ [LucideIcons] (giống 100% với Web React `lucide-react`).
class LambeIconWidget extends StatelessWidget {
  final String? iconStr;
  final double size;
  final double? imageSize;
  final BoxFit imageFit;
  final Color? color;
  final IconData? fallbackIcon;

  const LambeIconWidget({
    super.key,
    required this.iconStr,
    this.size = 24.0,
    this.imageSize,
    this.imageFit = BoxFit.cover,
    this.color,
    this.fallbackIcon,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppColors.primary;
    final fallback = fallbackIcon ?? LucideIcons.sparkles;

    if (iconStr == null || iconStr!.trim().isEmpty) {
      return Icon(fallback, size: size, color: effectiveColor);
    }

    final trimmed = iconStr!.trim();

    // 1. Trường hợp là URL từ CDN / Cloudinary / Server
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      String cleanUrl = trimmed;
      IconData activeFallback = fallback;

      final hashIndex = trimmed.indexOf('#');
      if (hashIndex != -1) {
        cleanUrl = trimmed.substring(0, hashIndex);
        final fragment = trimmed.substring(hashIndex + 1);
        final match = RegExp(r'fallback=([a-zA-Z0-9_-]+)').firstMatch(fragment);
        if (match != null) {
          activeFallback = LucideIconMapper.fromString(
            match.group(1),
            fallback: fallback,
          );
        }
      }

      final effectiveImageSize = imageSize ?? size;
      final isSvg = cleanUrl.toLowerCase().contains('.svg');
      if (isSvg) {
        return SvgPicture.network(
          cleanUrl,
          width: effectiveImageSize,
          height: effectiveImageSize,
          fit: imageFit,
          colorFilter: color != null
              ? ColorFilter.mode(effectiveColor, BlendMode.srcIn)
              : null,
          placeholderBuilder: (_) =>
              Icon(activeFallback, size: size, color: effectiveColor),
        );
      }

      return CachedNetworkImage(
        imageUrl: cleanUrl,
        width: effectiveImageSize,
        height: effectiveImageSize,
        fit: imageFit,
        placeholder: (_, __) =>
            Icon(activeFallback, size: size, color: effectiveColor),
        errorWidget: (_, __, ___) =>
            Icon(activeFallback, size: size, color: effectiveColor),
      );
    }

    // 2. Trường hợp là Asset nội bộ
    if (trimmed.startsWith('assets/')) {
      if (trimmed.toLowerCase().endsWith('.svg')) {
        return SvgPicture.asset(
          trimmed,
          width: size,
          height: size,
          colorFilter: color != null
              ? ColorFilter.mode(effectiveColor, BlendMode.srcIn)
              : null,
        );
      }
      return Image.asset(
        trimmed,
        width: size,
        height: size,
        fit: BoxFit.contain,
      );
    }

    // 3. Trường hợp là mã icon Vector chuẩn (Lucide Icons)
    final iconData = LucideIconMapper.fromString(trimmed, fallback: fallback);
    return Icon(iconData, size: size, color: effectiveColor);
  }
}
