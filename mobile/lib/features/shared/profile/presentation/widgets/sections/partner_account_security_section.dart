import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../layout/partner_account_tile.dart';

class PartnerAccountSecuritySection extends StatelessWidget {
  final double walletBalance;
  final VoidCallback? onWalletTap;
  final VoidCallback? onIdentityTap;
  final VoidCallback? onNotificationSoundTap;
  final VoidCallback? onSafetyStandardsTap;
  final VoidCallback? onSupportCenterTap;

  const PartnerAccountSecuritySection({
    super.key,
    required this.walletBalance,
    this.onWalletTap,
    this.onIdentityTap,
    this.onNotificationSoundTap,
    this.onSafetyStandardsTap,
    this.onSupportCenterTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currencyFormatter = NumberFormat('#,###', 'vi_VN');
    final formattedBalance = currencyFormatter.format(walletBalance.toInt());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Text(
            'TÀI KHOẢN & BẢO MẬT',
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 11,
              color: AppColors.tertiary,
              letterSpacing: 0.8,
            ),
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
              // Wallet Tile
              PartnerAccountTile(
                icon: Icons.account_balance_wallet_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.primary,
                title: 'Ví nhận đơn & Thanh toán',
                subtitle: 'Xem số dư, nạp tiền & lịch sử giao dịch',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$formattedBalance đ',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
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
                onTap: onWalletTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              // KYC / CCCD Tile
              PartnerAccountTile(
                icon: Icons.badge_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Thông tin cá nhân & CCCD',
                subtitle: 'Thông tin tài khoản đối tác',
                onTap: onIdentityTap,
              ),
              if (onNotificationSoundTap != null) ...[
                const Divider(
                  height: 1,
                  indent: 56,
                  color: AppColors.surfaceContainer,
                ),
                PartnerAccountTile(
                  icon: Icons.notifications_active_rounded,
                  iconBackgroundColor: AppColors.surfaceContainer,
                  iconColor: AppColors.tertiary,
                  title: 'Chuông báo & Âm thanh nhận đơn',
                  subtitle: 'Cấu hình thông báo đơn hàng mới',
                  onTap: onNotificationSoundTap,
                ),
              ],
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              // Safety Standards Tile
              PartnerAccountTile(
                icon: Icons.verified_user_rounded,
                iconBackgroundColor: const Color(0xFFFFDBC8)
                    .withValues(alpha: 0.5),
                iconColor: AppColors.secondary,
                title: 'Quy chuẩn an toàn & 5 sao Lambe',
                subtitle: 'Bộ vệ sinh vô trùng, tác phong',
                onTap: onSafetyStandardsTap,
              ),
              const Divider(
                height: 1,
                indent: 56,
                color: AppColors.surfaceContainer,
              ),
              // Support Center Tile
              PartnerAccountTile(
                icon: Icons.support_agent_rounded,
                iconBackgroundColor: AppColors.surfaceContainer,
                iconColor: AppColors.tertiary,
                title: 'Trung tâm trợ giúp đối tác',
                subtitle: 'Liên hệ hỗ trợ qua email partner@lambe.vn',
                onTap: onSupportCenterTap,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
