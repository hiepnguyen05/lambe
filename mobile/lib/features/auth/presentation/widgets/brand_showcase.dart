import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_logo.dart';

class BrandShowcase extends StatelessWidget {
  final String title;
  final String subtitle;

  const BrandShowcase({
    super.key,
    this.title = 'Chào mừng bạn đến với Lambe',
    this.subtitle = 'Nhập số điện thoại để tiếp tục',
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLow,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Center(
            child: AppLogo(width: 48, height: 48),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          title,
          style: AppTypography.headlineLg.copyWith(
            fontSize: 21,
            fontWeight: FontWeight.bold,
            color: AppColors.onSurface,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: AppTypography.bodyMd.copyWith(
            color: AppColors.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
