import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_typography.dart';

class CompleteRegistrationCard extends StatelessWidget {
  final TextEditingController controller;
  final GlobalKey<FormState> formKey;
  final bool isLoading;
  final VoidCallback onSubmit;

  const CompleteRegistrationCard({
    super.key,
    required this.controller,
    required this.formKey,
    required this.isLoading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.outlineVariant.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hoàn tất thông tin cá nhân',
              style: AppTypography.headlineSm.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Bạn là người dùng mới! Vui lòng nhập họ và tên để khởi tạo tài khoản.',
              style: AppTypography.bodyMd.copyWith(fontSize: 13),
            ),
            const SizedBox(height: 20),
            Text(
              'Họ và Tên của bạn',
              style: AppTypography.headlineSm.copyWith(fontSize: 14),
            ),
            const SizedBox(height: 8),

            // Input Container - Màu trắng bình thường
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadii.borderMd,
                border: Border.all(color: AppColors.outlineVariant.withValues(alpha: 0.6)),
              ),
              child: TextFormField(
                controller: controller,
                keyboardType: TextInputType.name,
                style: AppTypography.headlineSm.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.onSurface,
                ),
                decoration: InputDecoration(
                  hintText: 'Nguyễn Văn A',
                  hintStyle: AppTypography.bodyLg.copyWith(
                    color: AppColors.outline.withValues(alpha: 0.6),
                  ),
                  prefixIcon: const Icon(Icons.person_outline_rounded, color: AppColors.primary),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Vui lòng nhập họ và tên';
                  }
                  if (val.trim().length < 2) {
                    return 'Họ và tên phải có ít nhất 2 ký tự';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(height: 20),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: isLoading ? null : onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  shape: const StadiumBorder(),
                  elevation: 0,
                ),
                child: isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Hoàn tất & Đăng nhập',
                            style: AppTypography.button.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.check_circle_outline, size: 20),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
