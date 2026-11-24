import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class PartnerLogoutFooter extends StatelessWidget {
  final VoidCallback? onLogoutTap;

  const PartnerLogoutFooter({super.key, this.onLogoutTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        // Logout Button
        Material(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onLogoutTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.15),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.logout_rounded,
                    color: AppColors.error,
                    size: 19,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Đăng xuất tài khoản',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: AppColors.error,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        // App Version and Footer Note
        Column(
          children: [
            Text(
              'Phiên bản Lambe Partner v2.4.0 (Build 382)',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.outline,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Bảo vệ quyền lợi & chuẩn y tế đối tác',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.outlineVariant,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
