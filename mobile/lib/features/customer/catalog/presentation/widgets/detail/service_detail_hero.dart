import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Khối Banner Hero ảnh dịch vụ chuẩn 100% theo mẫu HTML:
/// Chiều cao 256px (h-64), bo góc 24px (rounded-3xl), gradient đáy nghệ thuật,
/// huy hiệu "Phổ biến nhất" góc trên trái và huy hiệu thời lượng góc dưới phải.
class ServiceDetailHero extends StatelessWidget {
  final String? imageUrl;
  final int durationMinutes;
  final String? badgeText;

  const ServiceDetailHero({
    super.key,
    this.imageUrl,
    required this.durationMinutes,
    this.badgeText = 'Phổ biến nhất',
  });

  @override
  Widget build(BuildContext context) {
    const defaultImage =
        'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1000&q=80';
    final effectiveImage = (imageUrl != null && imageUrl!.startsWith('http'))
        ? imageUrl!
        : defaultImage;

    final durationDisplay = durationMinutes > 0
        ? '$durationMinutes phút'
        : '45 phút';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24), // rounded-3xl
        child: Container(
          height: 256, // h-64 (256px)
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 1. Ảnh bìa dịch vụ
              CachedNetworkImage(
                imageUrl: effectiveImage,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  color: AppColors.surfaceContainerLow,
                  child: const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primaryContainer,
                      ),
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => Container(
                  color: AppColors.surfaceContainerLow,
                  child: const Center(
                    child: Icon(
                      Icons.spa_rounded,
                      size: 48,
                      color: AppColors.primaryContainer,
                    ),
                  ),
                ),
              ),

              // 2. Lớp phủ Gradient đen mờ từ dưới đáy lên
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      AppColors.onSurface.withValues(alpha: 0.40),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.6],
                  ),
                ),
              ),

              // 3. Huy hiệu góc trên bên trái: "Phổ biến nhất"
              if (badgeText != null && badgeText!.isNotEmpty)
                Positioned(
                  top: 14,
                  left: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primaryFixed, // bg-primary-fixed (#9CF2E8)
                      borderRadius: BorderRadius.circular(100),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.local_fire_department_rounded,
                          size: 15,
                          color: AppColors.onPrimaryFixedVariant, // #00504A
                        ),
                        const SizedBox(width: 4),
                        Text(
                          badgeText!,
                          style: const TextStyle(
                            fontSize: 12, // font-label-md
                            fontWeight: FontWeight.w600,
                            color: AppColors.onPrimaryFixedVariant,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // 4. Huy hiệu góc dưới bên phải: Thời lượng dịch vụ
              Positioned(
                bottom: 14,
                right: 14,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(100),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerLowest.withValues(alpha: 0.90),
                        borderRadius: BorderRadius.circular(100),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.schedule_rounded,
                            size: 14,
                            color: AppColors.primary, // text-primary
                          ),
                          const SizedBox(width: 4),
                          Text(
                            durationDisplay,
                            style: const TextStyle(
                              fontSize: 11, // font-label-sm
                              fontWeight: FontWeight.w600,
                              color: AppColors.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
