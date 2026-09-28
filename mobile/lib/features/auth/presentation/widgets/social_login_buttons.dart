import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class SocialLoginButtons extends StatelessWidget {
  final VoidCallback? onGoogleTap;
  final VoidCallback? onFacebookTap;

  const SocialLoginButtons({
    super.key,
    this.onGoogleTap,
    this.onFacebookTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildSocialButton(
          label: 'Tiếp tục với Google',
          icon: _buildGoogleIcon(),
          onTap: onGoogleTap,
        ),
        const SizedBox(height: 12),
        _buildSocialButton(
          label: 'Tiếp tục với Facebook',
          icon: const Icon(Icons.facebook, color: Color(0xFF1877F2), size: 24),
          onTap: onFacebookTap,
        ),
      ],
    );
  }

  Widget _buildSocialButton({
    required String label,
    required Widget icon,
    VoidCallback? onTap,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton(
        onPressed: onTap ?? () {},
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.surfaceContainerLowest,
          side: BorderSide(color: AppColors.outlineVariant.withValues(alpha: 0.6)),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 12),
            Text(
              label,
              style: AppTypography.button.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGoogleIcon() {
    return Container(
      width: 20,
      height: 20,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
      ),
      child: CustomPaint(
        painter: _GoogleIconPainter(),
      ),
    );
  }
}

class _GoogleIconPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    final Paint blue = Paint()..color = const Color(0xFF4285F4);
    final Paint green = Paint()..color = const Color(0xFF34A853);
    final Paint yellow = Paint()..color = const Color(0xFFFBBC05);
    final Paint red = Paint()..color = const Color(0xFFEA4335);

    final center = Offset(w / 2, h / 2);
    final radius = w / 2;

    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -0.5, 1.5, true, blue);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), 1.0, 1.5, true, green);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), 2.5, 1.0, true, yellow);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), 3.5, 1.5, true, red);

    final Paint whiteCenter = Paint()..color = Colors.white;
    canvas.drawCircle(center, radius * 0.5, whiteCenter);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
