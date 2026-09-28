import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class AuthAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;

  const AuthAppBar({
    super.key,
    this.title = 'Đăng nhập',
  });

  @override
  Size get preferredSize => const Size.fromHeight(56.0);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false, // Bỏ dấu back ở header
      centerTitle: true,
      elevation: 0,
      backgroundColor: AppColors.background.withValues(alpha: 0.9),
      title: Text(
        title,
        style: AppTypography.headlineSm.copyWith(
          color: AppColors.onSurface,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
