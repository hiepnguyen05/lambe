import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/app_dialogs.dart';
import '../../../auth/di/auth_providers.dart';
import '../../../provider_income/di/provider_income_providers.dart';
import '../../../provider_workspace/di/provider_workspace_providers.dart';
import '../../di/partner_profile_providers.dart';
import '../../domain/entities/partner_profile_entity.dart';
import '../widgets/partner_account_app_bar.dart';
import '../widgets/partner_account_security_section.dart';
import '../widgets/partner_dispatch_config_section.dart';
import '../widgets/partner_logout_footer.dart';
import '../widgets/partner_mode_switch_card.dart';
import '../widgets/partner_profile_header_card.dart';
import '../widgets/partner_quick_stats_grid.dart';
import '../widgets/partner_service_management_section.dart';

class PartnerProfileScreen extends ConsumerWidget {
  const PartnerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.value;

    final profileAsync = ref.watch(partnerProfileNotifierProvider);
    final walletState = ref.watch(providerWalletNotifierProvider);
    final dashboardAsync = ref.watch(providerDashboardProvider);

    // Initial load wallet if needed
    ref.listen(providerWalletNotifierProvider, (_, next) {});

    final baseProfile = profileAsync.value;
    final effectiveProfile =
        (baseProfile ??
                const PartnerProfileEntity(
                  id: '',
                  displayName: 'Đối tác Lambe',
                ))
            .copyWith(
              displayName:
                  (user?.fullName != null && user!.fullName!.isNotEmpty)
                  ? user.fullName!
                  : baseProfile?.displayName,
              avatarUrl: user?.avatarUrl ?? baseProfile?.avatarUrl,
              serviceRadiusKm:
                  dashboardAsync.value?.serviceRadius ??
                  baseProfile?.serviceRadiusKm,
              isDispatchEnabled:
                  dashboardAsync.value?.isOnline ??
                  baseProfile?.isDispatchEnabled,
            );

    final walletBalance = walletState.wallet?.availableAmount ?? 0;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await Future.wait([
            ref.read(partnerProfileNotifierProvider.notifier).refresh(),
            ref.read(providerWalletNotifierProvider.notifier).loadWalletData(),
            ref.refresh(providerDashboardProvider.future),
          ]);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Top App Bar
            PartnerAccountAppBar(
              avatarUrl: effectiveProfile.avatarUrl,
              onNotificationTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Không có thông báo mới.'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
            ),
            // Profile Content List
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              sliver: SliverList(
                delegate: SliverChildListDelegate.fixed([
                  // 1. Profile Header Card
                  PartnerProfileHeaderCard(
                    profile: effectiveProfile,
                    onViewPublicProfileTap: () {
                      _showPublicProfileSheet(context, effectiveProfile);
                    },
                  ),
                  const SizedBox(height: 12),
                  // 2. Quick Stats Grid
                  PartnerQuickStatsGrid(
                    completedBookings: effectiveProfile.completedBookings,
                    acceptanceRate: effectiveProfile.acceptanceRate,
                    onTimeRate: effectiveProfile.onTimeRate,
                  ),
                  const SizedBox(height: 14),
                  // Switch to Customer Mode
                  PartnerModeSwitchCard(
                    onSwitchTap: () {
                      context.go('/home');
                    },
                  ),
                  const SizedBox(height: 16),
                  // 3. Section 1: Services & Expertise
                  PartnerServiceManagementSection(
                    profile: effectiveProfile,
                    onServicesTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Dịch vụ của tôi',
                        message: effectiveProfile.servicesSummary,
                      );
                    },
                    onCertificatesTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Chứng chỉ nghề',
                        message: effectiveProfile.certificatesCount == null
                            ? 'Chưa có dữ liệu chứng chỉ.'
                            : 'Đã xác thực ${effectiveProfile.certificatesCount} chứng chỉ.',
                      );
                    },
                    onPortfolioTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Bộ sưu tập tác phẩm',
                        message: effectiveProfile.portfolioPhotosCount == null
                            ? 'Chưa có dữ liệu portfolio.'
                            : 'Portfolio hiện có ${effectiveProfile.portfolioPhotosCount} hình ảnh.',
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  // 4. Section 2: Dispatch Config
                  PartnerDispatchConfigSection(
                    profile: effectiveProfile,
                    onToggleDispatch: (enabled) =>
                        _toggleDispatch(context, ref, enabled),
                    onRadiusTap: () {
                      _showRadiusDialog(
                        context,
                        ref,
                        effectiveProfile.serviceRadiusKm,
                      );
                    },
                    onScheduleTap: () {
                      context.push('/provider/schedule');
                    },
                  ),
                  const SizedBox(height: 16),
                  // 5. Section 3: Account & Security
                  PartnerAccountSecuritySection(
                    walletBalance: walletBalance,
                    onWalletTap: () {
                      // Navigate to Provider Income / Wallet Screen
                      context.push('/provider/income');
                    },
                    onIdentityTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Thông tin cá nhân & CCCD',
                        message:
                            'Hồ sơ đối tác đã định danh điện tử cấp 2 thành công. Số điện thoại: ${user?.phone ?? "Chưa cập nhật"}',
                      );
                    },
                    onNotificationSoundTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Chuông báo đơn hàng',
                        message: 'Chuông báo nhận đơn đang ở mức âm lượng cao nhất kèm chế độ rung liên tục để không bỏ lỡ khách hàng.',
                      );
                    },
                    onSafetyStandardsTap: () {
                      _showInfoDialog(
                        context,
                        title: 'Quy chuẩn an toàn Lambe 5 sao',
                        message: '1. Khử khuẩn bộ dụng cụ trước và sau khi làm dịch vụ.\n2. Tác phong lịch sự, đeo khẩu trang chuyên dụng.\n3. Đúng giờ hẹn và tư vấn tận tâm.',
                      );
                    },
                    onSupportCenterTap: () async {
                      final url = Uri.parse('tel:19008829');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      } else {
                        if (context.mounted) {
                          _showInfoDialog(
                            context,
                            title: 'Tổng đài đối tác',
                            message: 'Hotline hỗ trợ miễn phí 24/7: 1900 8829.',
                          );
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 20),
                  // 6. Logout & Version Footer
                  PartnerLogoutFooter(
                    onLogoutTap: () => _handleLogout(context, ref),
                  ),
                  // Extra space for bottom nav bar
                  const SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleDispatch(
    BuildContext context,
    WidgetRef ref,
    bool enabled,
  ) async {
    final error = await ref
        .read(providerDashboardProvider.notifier)
        .toggleOnlineStatus(enabled);
    if (error != null && context.mounted) {
      await AppDialogs.showErrorDialog(context, message: error);
    }
  }

  void _showRadiusDialog(
    BuildContext context,
    WidgetRef ref,
    int currentRadius,
  ) {
    int selected = currentRadius;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            'Bán kính nhận đơn',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$selected km quanh vị trí của bạn',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 16),
              Slider(
                value: selected.toDouble(),
                min: 1,
                max: 30,
                divisions: 29,
                label: '$selected km',
                activeColor: AppColors.primary,
                onChanged: (val) {
                  setState(() => selected = val.round());
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () {
                ref
                    .read(providerDashboardProvider.notifier)
                    .setRadius(selected);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'Đã cập nhật bán kính hoạt động: $selected km',
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text('Lưu'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPublicProfileSheet(
    BuildContext context,
    PartnerProfileEntity profile,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Hồ sơ công khai',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Giao diện khách hàng nhìn thấy khi tìm chuyên viên và đặt lịch:',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: AppColors.primary.withValues(
                          alpha: 0.1,
                        ),
                        child: const Icon(
                          Icons.person,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile.displayName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              profile.biography,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (profile.rating != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFDBC8),
                            borderRadius: BorderRadius.circular(100),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 14,
                                color: AppColors.secondary,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                profile.rating!.toStringAsFixed(2),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const Divider(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMiniInfo('Khu vực', profile.serviceAreaName),
                      _buildMiniInfo(
                        'Dịch vụ',
                        '${profile.activeServicesCount} gói',
                      ),
                      _buildMiniInfo(
                        'Xác minh',
                        profile.isVerified ? 'Đã xác minh' : 'Chưa có dữ liệu',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text('Đóng'),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _buildMiniInfo(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.outline),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
        ),
      ],
    );
  }

  void _showInfoDialog(
    BuildContext context, {
    required String title,
    required String message,
  }) {
    AppDialogs.showMessageDialog(context, title: title, message: message);
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirm = await AppDialogs.showConfirmDialog(
      context,
      title: 'Đăng xuất tài khoản',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng đối tác Lambe?',
      confirmText: 'Đăng xuất',
    );

    if (confirm == true && context.mounted) {
      await ref.read(authNotifierProvider.notifier).logout();
      if (context.mounted) {
        context.go('/auth');
      }
    }
  }
}
