import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/partner_profile_entity.dart';
import 'partner_account_tile.dart';

class PartnerDispatchConfigSection extends StatelessWidget {
  final PartnerProfileEntity profile;
  final ValueChanged<bool>? onToggleDispatch;
  final VoidCallback? onRadiusTap;
  final VoidCallback? onScheduleTap;

  const PartnerDispatchConfigSection({
    super.key,
    required this.profile,
    this.onToggleDispatch,
    this.onRadiusTap,
    this.onScheduleTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'CẤU HÌNH ĐIỀU PHỐI',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  color: AppColors.tertiary,
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        // Card Group
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: AppColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: [
              PartnerAccountTile(
                icon: Icons.near_me_rounded,
                iconBackgroundColor: AppColors.surfaceContainerHigh,
                iconColor: AppColors.primary,
                title: 'Khu vực & Bán kính hoạt động',
                subtitle:
                    '${profile.serviceRadiusKm} km quanh ${profile.serviceAreaName}',
                onTap: onRadiusTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.event_available_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Lịch rảnh & Giờ làm việc',
                subtitle: profile.workingHoursSummary,
                onTap: onScheduleTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.bolt_rounded,
                iconBackgroundColor: AppColors.primaryContainer.withValues(
                  alpha: 0.15,
                ),
                iconColor: AppColors.primary,
                title: 'Đơn làm ngay & Đặt trước',
                subtitle: profile.isDispatchEnabled
                    ? 'Đang bật cả 2 chế độ'
                    : 'Tạm tắt nhận đơn làm ngay',
                trailing: SizedBox(
                  height: 30,
                  child: Switch.adaptive(
                    value: profile.isDispatchEnabled,
                    onChanged: onToggleDispatch,
                    activeThumbColor: AppColors.primary,
                    activeTrackColor: AppColors.primary.withValues(alpha: 0.4),
                  ),
                ),
                onTap: () {
                  if (onToggleDispatch != null) {
                    onToggleDispatch!(!profile.isDispatchEnabled);
                  }
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
