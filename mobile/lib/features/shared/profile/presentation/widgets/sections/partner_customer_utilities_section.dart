import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../layout/partner_account_tile.dart';

class PartnerCustomerUtilitiesSection extends StatelessWidget {
  final VoidCallback? onEditProfileTap;
  final VoidCallback? onPreferencesTap;
  final VoidCallback? onAddressTap;
  final VoidCallback? onNotificationSettingsTap;
  final VoidCallback? onSupportCenterTap;
  final VoidCallback? onTermsTap;

  const PartnerCustomerUtilitiesSection({
    super.key,
    this.onEditProfileTap,
    this.onPreferencesTap,
    this.onAddressTap,
    this.onNotificationSettingsTap,
    this.onSupportCenterTap,
    this.onTermsTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section 1 Header: TIỆN ÍCH DỊCH VỤ & LÀM ĐẸP
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Text(
            'TIỆN ÍCH DỊCH VỤ & LÀM ĐẸP',
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 11,
              color: AppColors.tertiary,
              letterSpacing: 0.8,
            ),
          ),
        ),
        const SizedBox(height: 4),
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
                icon: Icons.person_outline_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.primary,
                title: 'Thông tin cá nhân',
                subtitle: 'Chỉnh sửa họ tên, giới tính, số điện thoại',
                onTap: onEditProfileTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.face_retouching_natural_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.secondary,
                title: 'Sở thích làm đẹp',
                subtitle: 'Tùy chỉnh gợi ý phong cách & dịch vụ ưa chuộng',
                onTap: onPreferencesTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.location_on_outlined,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.primary,
                title: 'Sổ địa chỉ',
                subtitle: 'Quản lý danh sách địa chỉ nhận dịch vụ tận nơi',
                onTap: onAddressTap,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Section 2 Header: CÀI ĐẶT & HỖ TRỢ
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Text(
            'CÀI ĐẶT & HỖ TRỢ',
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 11,
              color: AppColors.tertiary,
              letterSpacing: 0.8,
            ),
          ),
        ),
        const SizedBox(height: 4),
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
                icon: Icons.notifications_none_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Cài đặt thông báo',
                subtitle: 'Nhận thông báo cập nhật lịch hẹn và ưu đãi',
                onTap: onNotificationSettingsTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.support_agent_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.primary,
                title: 'Trung tâm trợ giúp Lambe',
                subtitle: 'Giải đáp thắc mắc và hỗ trợ khách hàng',
                onTap: onSupportCenterTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              PartnerAccountTile(
                icon: Icons.description_outlined,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Điều khoản & Chính sách',
                subtitle: 'Quy chế hoạt động & bảo vệ quyền riêng tư',
                onTap: onTermsTap,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

