import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class TermsDisclaimer extends StatelessWidget {
  final VoidCallback? onTermsTap;
  final VoidCallback? onPrivacyTap;

  const TermsDisclaimer({
    super.key,
    this.onTermsTap,
    this.onPrivacyTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 32.0, bottom: 16.0),
      child: Center(
        child: RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: AppTypography.bodyMd.copyWith(
              fontSize: 12,
              color: AppColors.outline,
            ),
            children: [
              const TextSpan(text: 'Bằng việc tiếp tục, bạn đồng ý với '),
              TextSpan(
                text: 'Điều khoản',
                style: AppTypography.bodyMd.copyWith(
                  fontSize: 12,
                  color: AppColors.primary,
                  decoration: TextDecoration.underline,
                ),
                recognizer: TapGestureRecognizer()..onTap = onTermsTap,
              ),
              const TextSpan(text: ' & '),
              TextSpan(
                text: 'Chính sách',
                style: AppTypography.bodyMd.copyWith(
                  fontSize: 12,
                  color: AppColors.primary,
                  decoration: TextDecoration.underline,
                ),
                recognizer: TapGestureRecognizer()..onTap = onPrivacyTap,
              ),
              const TextSpan(text: ' của Lambe'),
            ],
          ),
        ),
      ),
    );
  }
}
