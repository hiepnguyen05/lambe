import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Helper ánh xạ tên mã icon (hỗ trợ cả mã Lucide và Material cũ)
/// sang [IconData] vector chuẩn của Flutter Material.
class LucideIconMapper {
  LucideIconMapper._();

  static const Map<String, IconData> _iconMap = {
    // Nhóm tóc, cắt tỉa & salon
    'scissors': Icons.content_cut_rounded,
    'content_cut': Icons.content_cut_rounded,
    'cut': Icons.content_cut_rounded,
    'hair': Icons.content_cut_rounded,

    // Nhóm nhiệt, uốn tóc, sấy & tạo kiểu
    'flame': Icons.local_fire_department_rounded,
    'heat': Icons.local_fire_department_rounded,
    'fire': Icons.local_fire_department_rounded,
    'wind': Icons.air_rounded,
    'air': Icons.air_rounded,
    'airwave': Icons.air_rounded,

    // Nhóm nhuộm tóc & bảng màu
    'palette': Icons.palette_rounded,
    'color': Icons.palette_rounded,
    'colorize': Icons.palette_rounded,

    // Nhóm làm móng & cọ vẽ
    'brush': Icons.brush_rounded,
    'paintbrush': Icons.brush_rounded,
    'nail': Icons.brush_rounded,
    'draw': Icons.edit_rounded,

    // Nhóm spa, hoa & thư giãn
    'flower_2': Icons.local_florist_rounded,
    'flower2': Icons.local_florist_rounded,
    'flower': Icons.local_florist_rounded,
    'spa': Icons.spa_rounded,
    'self_improvement': Icons.self_improvement_rounded,
    'local_florist': Icons.local_florist_rounded,
    'healing': Icons.monitor_heart_rounded,

    // Nhóm chăm sóc da & khuôn mặt
    'smile': Icons.face_rounded,
    'face': Icons.face_rounded,
    'face_3': Icons.face_rounded,
    'face_4': Icons.face_rounded,
    'face_6': Icons.face_rounded,

    // Nhóm trang điểm, combo & làm đẹp cao cấp
    'sparkles': Icons.auto_awesome_rounded,
    'sparkle': Icons.auto_awesome_rounded,
    'face_retouching_natural': Icons.auto_awesome_rounded,
    'auto_awesome': Icons.auto_awesome_rounded,
    'health_and_beauty': Icons.auto_awesome_rounded,
    'makeup': Icons.auto_awesome_rounded,
    'cheer': Icons.auto_awesome_rounded,
    'menu': Icons.auto_awesome_rounded,

    // Nhóm gội đầu, nước & vệ sinh
    'droplets': Icons.water_drop_rounded,
    'droplet': Icons.water_drop_rounded,
    'wash': Icons.water_drop_rounded,
    'water_drop': Icons.water_drop_rounded,
    'shower': Icons.shower_rounded,
    'shower_head': Icons.shower_rounded,
    'bath': Icons.bathtub_rounded,
    'bathtub': Icons.bathtub_rounded,
    'soap': Icons.auto_awesome_rounded,

    // Nhóm tẩy tóc & nâng tone
    'wand_2': Icons.auto_fix_high_rounded,
    'wand2': Icons.auto_fix_high_rounded,
    'wand': Icons.auto_fix_high_rounded,
    'cleaning_services': Icons.auto_fix_high_rounded,

    // Nhóm mắt, nối mi
    'eye': Icons.visibility_rounded,
    'visibility': Icons.visibility_rounded,

    // Nhóm môi, tim, phun xăm thẩm mỹ
    'heart': Icons.favorite_rounded,
    'lips': Icons.favorite_rounded,
    'lip': Icons.favorite_rounded,

    // Nhóm y tế, bảo hành, chứng nhận & an toàn
    'shield_check': Icons.verified_user_rounded,
    'shield': Icons.shield_rounded,
    'security': Icons.shield_rounded,
    'health_and_safety': Icons.health_and_safety_rounded,
    'medical_services': Icons.medical_services_rounded,
    'verified': Icons.check_circle_rounded,
    'check_circle': Icons.check_circle_rounded,

    // Nhóm đồng hồ, lịch & danh mục
    'clock': Icons.schedule_rounded,
    'schedule': Icons.schedule_rounded,
    'calendar': Icons.calendar_today_rounded,
    'star': Icons.star_rounded,
    'layout_grid': Icons.grid_view_rounded,
    'category': Icons.category_rounded,
  };

  /// Ánh xạ chuỗi tên icon sang [IconData].
  /// Hỗ trợ cả kebab-case, snake_case và camelCase.
  static IconData fromString(
    String? iconName, {
    IconData fallback = Icons.auto_awesome_rounded,
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
    final fallback = fallbackIcon ?? Icons.auto_awesome_rounded;

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
          errorBuilder: (_, __, ___) =>
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
