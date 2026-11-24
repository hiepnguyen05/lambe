import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class PartnerModeSwitchCard extends StatelessWidget {
  final bool isProvider;
  final bool isProviderMode;
  final VoidCallback onSwitchTap;

  const PartnerModeSwitchCard({
    super.key,
    this.isProvider = true,
    this.isProviderMode = true,
    required this.onSwitchTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final IconData icon;
    final String title;
    final String subtitle;
    final String buttonText;
    final IconData buttonIcon;
    const accentColor = AppColors.primary;

    if (!isProvider) {
      icon = Icons.handshake_rounded;
      title = 'Đăng ký trở thành đối tác';
      subtitle = 'Gia nhập mạng lưới chuyên viên làm đẹp Lambe';
      buttonText = 'Đăng ký';
      buttonIcon = Icons.arrow_forward_rounded;
    } else if (!isProviderMode) {
      icon = Icons.business_center_rounded;
      title = 'Chế độ Đối tác';
      subtitle = 'Không gian làm việc & nhận đơn dành cho chuyên gia';
      buttonText = 'Chuyển';
      buttonIcon = Icons.swap_horiz_rounded;
    } else {
      icon = Icons.face_retouching_natural_rounded;
      title = 'Chế độ Khách hàng';
      subtitle = 'Chuyển sang đặt lịch móng, tóc & spa tận nơi';
      buttonText = 'Chuyển';
      buttonIcon = Icons.swap_horiz_rounded;
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.16),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onSwitchTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                // Icon Avatar
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    icon,
                    color: accentColor,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                // Text Content - allow title to wrap without being cut off
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 14.5,
                          color: AppColors.onSurface,
                          height: 1.25,
                        ),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Action Pill Button
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: BorderRadius.circular(100),
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.22),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        buttonText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 3),
                      Icon(
                        buttonIcon,
                        color: Colors.white,
                        size: 15,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
