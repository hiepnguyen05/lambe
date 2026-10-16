import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../theme/app_colors.dart';

/// Helper ánh xạ tên mã Google Material Symbols / Material Icons được lưu trong DB
/// sang [IconData] chuẩn của Flutter SDK.
class MaterialIconMapper {
  MaterialIconMapper._();

  static const Map<String, IconData> _iconMap = {
    // Nhóm tóc & cắt tỉa
    'content_cut': Icons.content_cut_rounded,
    'cut': Icons.content_cut_rounded,
    'scissors': Icons.content_cut_rounded,
    'hair': Icons.content_cut_rounded,
    'air': Icons.air_rounded,
    'airwave': Icons.air_rounded,
    'heat': Icons.whatshot_rounded,
    'dry_cleaning': Icons.dry_cleaning_rounded,

    // Nhóm móng & trang điểm & cọ
    'brush': Icons.brush_rounded,
    'nail': Icons.brush_rounded,
    'draw': Icons.draw_rounded,
    'palette': Icons.palette_rounded,
    'color': Icons.palette_rounded,
    'colorize': Icons.colorize_rounded,
    'face_retouching_natural': Icons.face_retouching_natural_rounded,
    'makeup': Icons.face_retouching_natural_rounded,
    'auto_fix_high': Icons.auto_fix_high_rounded,
    'lips': Icons.favorite_rounded,
    'lip': Icons.favorite_rounded,

    // Nhóm chăm sóc da & khuôn mặt
    'face': Icons.face_rounded,
    'face_3': Icons.face_3_rounded,
    'face_4': Icons.face_4_rounded,
    'face_6': Icons.face_6_rounded,
    'clean_hands': Icons.clean_hands_rounded,
    'visibility': Icons.visibility_rounded,
    'eye': Icons.visibility_rounded,

    // Nhóm spa, massage & thư giãn
    'spa': Icons.spa_rounded,
    'self_improvement': Icons.self_improvement_rounded,
    'local_florist': Icons.local_florist_rounded,
    'flower': Icons.local_florist_rounded,
    'healing': Icons.healing_rounded,
    'cheer': Icons.celebration_rounded,

    // Nhóm gội đầu & tắm & vệ sinh
    'wash': Icons.wash_rounded,
    'water_drop': Icons.water_drop_rounded,
    'shower': Icons.shower_rounded,
    'bathtub': Icons.bathtub_rounded,
    'soap': Icons.soap_rounded,
    'cleaning_services': Icons.cleaning_services_rounded,
    'sanitizer': Icons.sanitizer_rounded,

    // Nhóm chất lượng, y tế & chứng chỉ
    'health_and_beauty': Icons.health_and_safety_rounded,
    'health_and_safety': Icons.health_and_safety_rounded,
    'medical_services': Icons.medical_services_rounded,
    'medication': Icons.medication_rounded,
    'shield': Icons.shield_rounded,
    'security': Icons.security_rounded,
    'verified': Icons.verified_rounded,

    // Nhóm chung & trang trí
    'favorite': Icons.favorite_rounded,
    'star': Icons.star_rounded,
    'diamond': Icons.diamond_rounded,
    'flare': Icons.flare_rounded,
    'auto_awesome': Icons.auto_awesome_rounded,
    'style': Icons.style_rounded,
    'sentiment_satisfied': Icons.sentiment_satisfied_rounded,
    'category': Icons.category_rounded,
    'person': Icons.person_rounded,
    'menu': Icons.auto_awesome_rounded,
  };

  /// Ánh xạ chuỗi tên icon (VD: 'content_cut', 'spa', 'brush') sang [IconData].
  /// Nếu không tìm thấy, trả về [fallback].
  static IconData fromString(String? iconName, {IconData fallback = Icons.auto_awesome_rounded}) {
    if (iconName == null || iconName.trim().isEmpty) {
      return fallback;
    }

    final key = iconName.trim().toLowerCase().replaceAll('-', '_');
    return _iconMap[key] ?? fallback;
  }
}

/// Widget hiển thị icon linh hoạt:
/// - Nếu là URL (bắt đầu bằng http/https): Hiển thị ảnh mạng qua [CachedNetworkImage].
/// - Nếu là tên Google Material Symbol/Icon (VD: 'content_cut', 'spa', 'brush'):
///   Hiển thị icon vector chuẩn của Google Material Icons.
class LambeIconWidget extends StatelessWidget {
  final String? iconStr;
  final double size;
  final Color? color;
  final IconData? fallbackIcon;

  const LambeIconWidget({
    super.key,
    required this.iconStr,
    this.size = 24.0,
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

    // 1. Trường hợp là URL ảnh từ Cloudinary/Server
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: trimmed,
        width: size,
        height: size,
        fit: BoxFit.contain,
        placeholder: (_, __) => Icon(fallback, size: size, color: effectiveColor),
        errorWidget: (_, __, ___) => Icon(fallback, size: size, color: effectiveColor),
      );
    }

    // 2. Trường hợp là mã Google Material Symbol lưu trong Database
    final iconData = MaterialIconMapper.fromString(trimmed, fallback: fallback);
    return Icon(
      iconData,
      size: size,
      color: effectiveColor,
    );
  }
}
