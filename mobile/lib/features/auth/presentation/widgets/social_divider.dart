import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class SocialDivider extends StatelessWidget {
  final String label;

  const SocialDivider({
    super.key,
    this.label = 'HOẶC TIẾP TỤC VỚI',
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24.0),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 1,
              color: AppColors.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0),
            child: Text(
              label,
              style: AppTypography.labelMd.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.outline,
                letterSpacing: 1.2,
              ),
            ),
          ),
          Expanded(
            child: Container(
              height: 1,
              color: AppColors.outlineVariant.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}
