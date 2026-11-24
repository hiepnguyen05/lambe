import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../../domain/entities/partner_profile_entity.dart';
import '../layout/partner_account_tile.dart';

class PartnerServiceManagementSection extends StatelessWidget {
  final PartnerProfileEntity profile;
  final VoidCallback? onServicesTap;
  final VoidCallback? onCertificatesTap;
  final VoidCallback? onPortfolioTap;

  const PartnerServiceManagementSection({
    super.key,
    required this.profile,
    this.onServicesTap,
    this.onCertificatesTap,
    this.onPortfolioTap,
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
                'CHUYÊN MÔN & DỊCH VỤ',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  color: AppColors.tertiary,
                  letterSpacing: 0.8,
                ),
              ),
              Text(
                '${profile.activeServicesCount} hoạt động',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  color: AppColors.primary,
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
                icon: Icons.spa_rounded,
                iconBackgroundColor: AppColors.primaryContainer.withValues(
                  alpha: 0.15,
                ),
                iconColor: AppColors.primary,
                title: 'Dịch vụ của tôi',
                subtitle: profile.servicesSummary,
                onTap: onServicesTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.workspace_premium_rounded,
                iconBackgroundColor: const Color(0xFFFFDBC8)
                    .withValues(alpha: 0.6),
                iconColor: AppColors.secondary,
                title: 'Chứng chỉ & Bằng cấp nghề',
                titleSuffix: const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.primary,
                  size: 15,
                ),
                subtitle: profile.certificatesCount == null
                    ? 'Chưa có dữ liệu chứng chỉ'
                    : '${profile.certificatesCount} chứng chỉ đã xác thực',
                onTap: onCertificatesTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.photo_library_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Beauty Feed của tôi',
                subtitle: 'Đăng tác phẩm và quản lý bài viết',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Mở',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.chevron_right,
                      color: AppColors.outline,
                      size: 18,
                    ),
                  ],
                ),
                onTap: onPortfolioTap,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
