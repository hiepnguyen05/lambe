import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class HomeHeroBanner extends StatelessWidget {
  final VoidCallback? onBannerTap;

  const HomeHeroBanner({
    super.key,
    this.onBannerTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primaryContainer,
            Color(0xFF004D47),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(
          children: [
            // Decorative background glowing bubbles
            Positioned(
              right: -24,
              bottom: -24,
              child: Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.1),
                ),
              ),
            ),
            Positioned(
              top: 10,
              right: 40,
              child: Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFFDBC8).withValues(alpha: 0.15),
                ),
              ),
            ),
            // Content
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onBannerTap,
                borderRadius: BorderRadius.circular(22),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Badge "CHUẨN SPA TẠI GIA"
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.workspace_premium_rounded,
                              size: 14,
                              color: Color(0xFFFFDBC8),
                            ),
                            SizedBox(width: 4),
                            Text(
                              'CHUẨN SPA TẠI GIA',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFFFDBC8),
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      // Big Title
                      RichText(
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: 'Làm Đẹp Tại Nhà\n',
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                fontSize: 22,
                                color: Colors.white,
                                height: 1.25,
                              ),
                            ),
                            const TextSpan(
                              text: 'Tận Tâm & Chu Đáo',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 22,
                                color: Color(0xFF9CF2E8),
                                height: 1.25,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 6),
                      // Promo discount
                      Row(
                        children: [
                          const Text(
                            'Giảm ',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          const Text(
                            '20%',
                            style: TextStyle(
                              color: Color(0xFFFFDBC8),
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          const Text(
                            ' lần đầu đặt lịch • Mã ',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'LAMBEHOME',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Trust Mini Badges
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _buildMiniBadge(
                            icon: Icons.verified_user_rounded,
                            iconColor: const Color(0xFF9CF2E8),
                            text: '100% Duyệt CCCD & Bằng cấp',
                          ),
                          _buildMiniBadge(
                            icon: Icons.payments_rounded,
                            iconColor: const Color(0xFFFFDBC8),
                            text: 'Thanh toán sau khi hài lòng',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniBadge({
    required IconData icon,
    required Color iconColor,
    required String text,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: iconColor),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
