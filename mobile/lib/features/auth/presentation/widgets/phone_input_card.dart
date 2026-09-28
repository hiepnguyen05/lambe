import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_typography.dart';

class PhoneInputCard extends StatelessWidget {
  final TextEditingController controller;
  final GlobalKey<FormState> formKey;
  final bool isLoading;
  final bool isPhoneValid;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmit;

  const PhoneInputCard({
    super.key,
    required this.controller,
    required this.formKey,
    required this.isLoading,
    required this.isPhoneValid,
    required this.onChanged,
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
              'Số điện thoại của bạn',
              style: AppTypography.headlineSm.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),

            // Input Container - Màu trắng bình thường
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadii.borderMd,
                border: Border.all(
                  color: isPhoneValid
                      ? AppColors.primary
                      : AppColors.outlineVariant.withValues(alpha: 0.6),
                  width: isPhoneValid ? 1.5 : 1.0,
                ),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 12),
                  // Country Code Pill
                  Row(
                    children: [
                      Text(
                        'VN +84',
                        style: AppTypography.headlineSm.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onSurface,
                        ),
                      ),
                      const Icon(Icons.arrow_drop_down, color: AppColors.onSurfaceVariant, size: 20),
                    ],
                  ),
                  Container(
                    width: 1,
                    height: 24,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    color: AppColors.outlineVariant.withValues(alpha: 0.5),
                  ),

                  // Phone Number Field
                  Expanded(
                    child: TextFormField(
                      controller: controller,
                      keyboardType: TextInputType.phone,
                      onChanged: onChanged,
                      style: AppTypography.headlineSm.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        letterSpacing: 0.5,
                      ),
                      decoration: InputDecoration(
                        hintText: '0912 345 678',
                        hintStyle: AppTypography.bodyLg.copyWith(
                          color: AppColors.outline.withValues(alpha: 0.6),
                        ),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        isDense: true,
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Vui lòng nhập số điện thoại';
                        }
                        final digits = val.replaceAll(RegExp(r'\D'), '');
                        if (digits.length < 9 || digits.length > 11) {
                          return 'Số điện thoại không đúng định dạng';
                        }
                        return null;
                      },
                    ),
                  ),

                  // Valid Checkmark Icon
                  if (isPhoneValid)
                    const Padding(
                      padding: EdgeInsets.only(right: 12.0),
                      child: Icon(
                        Icons.check_circle,
                        color: AppColors.primary,
                        size: 22,
                      ),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 8),
            Text(
              'Mã OTP sẽ được gửi qua SMS hoặc Zalo',
              style: AppTypography.labelMd.copyWith(
                fontSize: 11,
                color: AppColors.onSurfaceVariant.withValues(alpha: 0.8),
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
                            'Tiếp tục',
                            style: AppTypography.button.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, size: 20),
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
