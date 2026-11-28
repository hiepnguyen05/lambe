import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/routing/app_mode.dart';
import 'package:mobile/core/routing/app_mode_provider.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/customer/recommendations/di/recommendations_providers.dart';
import 'package:mobile/features/provider/income/di/provider_income_providers.dart';
import 'package:mobile/features/provider/location/application/provider_session_logout.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/provider/members/presentation/providers/worker_workspace_notifier.dart';
import 'package:mobile/features/provider/members/presentation/widgets/organization_emergency_receiving_tile.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/notifications/data/push_device_service.dart';

import '../../di/partner_profile_providers.dart';
import '../../domain/entities/partner_profile_entity.dart';
import '../utils/profile_avatar_uploader.dart';
import '../widgets/layout/partner_account_app_bar.dart';
import '../widgets/layout/partner_account_tile.dart';
import '../widgets/layout/partner_logout_footer.dart';
import '../widgets/modals/partner_profile_modals.dart';
import '../widgets/sections/partner_account_security_section.dart';
import '../widgets/sections/partner_customer_utilities_section.dart';
import '../widgets/sections/partner_dispatch_config_section.dart';
import '../widgets/sections/partner_mode_switch_card.dart';
import '../widgets/sections/partner_profile_header_card.dart';
import '../widgets/sections/partner_quick_stats_grid.dart';
import '../widgets/sections/partner_service_management_section.dart';

class PartnerProfileScreen extends ConsumerWidget {
  const PartnerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.valueOrNull;

    if (user == null && authState.isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.surface,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (user == null && authState.hasError) {
      final error = authState.error;
      final errorMessage = error is AppFailure
          ? error.message
          : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.';
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          title: const Text(
            'Tài khoản',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          backgroundColor: AppColors.surface,
          elevation: 0,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.wifi_off_rounded,
                    size: 48,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  errorMessage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: AppColors.onSurface,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () {
                    ref
                        .read(authNotifierProvider.notifier)
                        .refreshSession(force: true);
                  },
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thử lại'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final isProvider = user?.roles.contains('PROVIDER') ?? false;
    final currentPath = GoRouterState.of(context).uri.path;
    final isProviderRoute = currentPath.startsWith('/provider');
    final appModeAsync = user != null
        ? ref.watch(appModeProvider(user.id))
        : null;
    final isProviderMode =
        isProvider &&
        (isProviderRoute || appModeAsync?.valueOrNull == AppMode.provider);

    final profileAsync = isProvider
        ? ref.watch(partnerProfileNotifierProvider)
        : null;
    final walletState = isProvider && isProviderMode
        ? ref.watch(providerWalletNotifierProvider)
        : null;
    final dashboardAsync = isProvider && isProviderMode
        ? ref.watch(providerDashboardProvider)
        : null;
    final workerWorkspace = isProvider && isProviderMode
        ? ref.watch(workerWorkspaceProvider)
        : null;
    final isOrgEnabled = ref.watch(isOrganizationFeatureEnabledProvider);
    final isWorker =
        isOrgEnabled && (workerWorkspace?.isWorkerInOrganization ?? false);
    final isOrgOwner =
        isOrgEnabled && (workerWorkspace?.activeMembership?.isOwner ?? false);

    final baseProfile = profileAsync?.valueOrNull;
    final defaultDisplayName = isProvider
        ? 'Đối tác Lambe'
        : 'Khách hàng Lambe';

    final effectiveProfile =
        (baseProfile ??
                PartnerProfileEntity(
                  id: isProvider ? (user?.id ?? '') : '',
                  displayName: defaultDisplayName,
                ))
            .copyWith(
              displayName:
                  (user?.fullName != null && user!.fullName!.isNotEmpty)
                  ? user.fullName!
                  : (baseProfile?.displayName ?? defaultDisplayName),
              avatarUrl: user?.avatarUrl ?? baseProfile?.avatarUrl,
              serviceRadiusKm:
                  dashboardAsync?.valueOrNull?.serviceRadius ??
                  baseProfile?.serviceRadiusKm,
              isDispatchEnabled:
                  dashboardAsync?.valueOrNull?.isOnline ??
                  baseProfile?.isDispatchEnabled,
            );

    final isOrganization =
        isOrgEnabled && (effectiveProfile.isOrganization || isOrgOwner);

    final walletBalance = walletState?.wallet?.availableAmount ?? 0;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          final futures = <Future>[
            ref.read(authNotifierProvider.notifier).refreshSession(force: true),
          ];
          if (isProvider) {
            futures.add(
              ref.read(partnerProfileNotifierProvider.notifier).refresh(),
            );
            if (isProviderMode) {
              futures.add(
                ref
                    .read(providerWalletNotifierProvider.notifier)
                    .loadWalletData(),
              );
              futures.add(ref.refresh(providerDashboardProvider.future));
            }
          }
          await Future.wait(futures);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Top App Bar
            PartnerAccountAppBar(
              avatarUrl: effectiveProfile.avatarUrl,
              badgeLabel: isProviderMode ? 'ĐỐI TÁC' : 'TÀI KHOẢN',
              onNotificationTap: () {
                context.push('/notifications');
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
                    isProvider: isProvider,
                    customerPhone: user?.phone,
                    onAvatarTap: () => pickAndUploadProfileAvatar(context, ref),
                    onViewPublicProfileTap: isProvider
                        ? () {
                            if (effectiveProfile.id.isNotEmpty) {
                              context.push(
                                '/providers/${effectiveProfile.id}/public',
                              );
                            } else {
                              PartnerProfileModals.showPublicProfileSheet(
                                context,
                                effectiveProfile,
                              );
                            }
                          }
                        : null,
                  ),
                  const SizedBox(height: 12),

                  // Provider Stats (only in Provider mode)
                  if (isProviderMode) ...[
                    PartnerQuickStatsGrid(
                      completedBookings: effectiveProfile.completedBookings,
                      acceptanceRate: effectiveProfile.acceptanceRate,
                      onTimeRate: effectiveProfile.onTimeRate,
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Mode Switch (only near top when already a Partner)
                  if (isProvider) ...[
                    PartnerModeSwitchCard(
                      isProvider: isProvider,
                      isProviderMode: isProviderMode,
                      onSwitchTap: () => _handleModeSwitch(
                        context,
                        ref,
                        isProvider: isProvider,
                        isProviderMode: isProviderMode,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  PartnerAccountTile(
                    icon: Icons.help_outline_rounded,
                    iconBackgroundColor: AppColors.surfaceContainer,
                    iconColor: AppColors.primary,
                    title: 'Hướng dẫn sử dụng',
                    subtitle: 'Xem lại các bước đặt lịch và thực hiện đơn',
                    onTap: () => context.push('/profile/guidance'),
                  ),
                  const SizedBox(height: 16),
                  // Mode-specific sections:
                  if (isProviderMode) ...[
                    // Provider: Services & Expertise
                    PartnerServiceManagementSection(
                      profile: effectiveProfile,
                      onServicesTap: () {
                        context.push('/provider/services');
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
                        context.push('/feed?mode=mine');
                      },
                    ),
                    const SizedBox(height: 16),

                    // Provider: Dispatch Config (Chỉ áp dụng cho Thợ tự do, Cơ sở dùng công tắc tổng)
                    if (!isOrganization) ...[
                      PartnerDispatchConfigSection(
                        profile: effectiveProfile,
                        onToggleDispatch: (enabled) =>
                            _toggleDispatch(context, ref, enabled),
                        onRadiusTap: () async {
                          final saved = await context.push<bool>(
                            '/provider/service-area',
                          );
                          if (saved == true && context.mounted) {
                            AppDialog.success(
                              context,
                              message: 'Đã lưu khu vực phục vụ.',
                            );
                          }
                        },
                        onScheduleTap: () {
                          context.push('/provider/schedule');
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Provider: Operations & Utilities
                    if (isWorker) ...[
                      // Worker workspace utilities (Never expose org wallet/balance)
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
                              icon: Icons.payments_rounded,
                              iconBackgroundColor: const Color(0xFFD1FAE5),
                              iconColor: const Color(0xFF059669),
                              title: 'Sổ đối soát tiền mặt thu hộ',
                              subtitle: 'Báo cáo tiền mặt đã thu từ khách',
                              onTap: () =>
                                  context.push('/provider/worker/collections'),
                            ),
                            const Divider(height: 1, indent: 64),
                            PartnerAccountTile(
                              icon: Icons.calendar_month_rounded,
                              iconBackgroundColor: const Color(0xFFEFF6FF),
                              iconColor: const Color(0xFF2563EB),
                              title: 'Lịch ca & Đăng ký nghỉ phép',
                              subtitle: 'Xem ca cố định, gửi đơn xin nghỉ',
                              onTap: () =>
                                  context.push('/provider/worker/schedule'),
                            ),
                            const Divider(height: 1, indent: 64),
                            PartnerAccountTile(
                              icon: Icons.verified_user_rounded,
                              iconBackgroundColor: const Color(0xFFF3E8FF),
                              iconColor: const Color(0xFF7C3AED),
                              title: 'Hồ sơ chuyên môn & KYC',
                              subtitle:
                                  'Kiểm tra chứng chỉ nghề & dịch vụ được giao',
                              onTap: () {
                                final id =
                                    workerWorkspace?.activeMembership?.id;
                                if (id != null) {
                                  context.push(
                                    '/provider/memberships/$id/verification/status',
                                  );
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ] else ...[
                      // Owner / Organization operations
                      if (isOrganization) ...[
                        const OrganizationEmergencyReceivingTile(),
                        const SizedBox(height: 16),
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
                                icon: Icons.rate_review_rounded,
                                iconBackgroundColor: const Color(0xFFFEF3C7),
                                iconColor: const Color(0xFFD97706),
                                title: 'Duyệt bài viết của nhân viên',
                                subtitle: 'Kiểm duyệt tác phẩm làm đẹp trước khi công khai',
                                onTap: () {
                                  context.push('/provider/feed-review');
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Provider: Team Management (for salons / facilities)
                      if (isOrganization) ...[
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
                          child: PartnerAccountTile(
                            icon: Icons.groups_rounded,
                            iconBackgroundColor: AppColors.primaryContainer
                                .withValues(alpha: 0.15),
                            iconColor: AppColors.primary,
                            title: 'Đội ngũ nhân sự & Thợ',
                            subtitle:
                                'Quản lý thành viên, gửi lời mời và phân công',
                            onTap: () {
                              context.push('/provider/members');
                            },
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Provider: Account & Security
                      PartnerAccountSecuritySection(
                        walletBalance: walletBalance,
                        onWalletTap: () {
                          context.push('/provider/income');
                        },
                        onIdentityTap: () {
                          context.push('/profile/edit');
                        },
                        onSafetyStandardsTap: () {
                          _showInfoDialog(
                            context,
                            title: 'Quy chuẩn an toàn Lambe 5 sao',
                            message: '1. Khử khuẩn bộ dụng cụ trước và sau khi làm dịch vụ.\n2. Tác phong lịch sự, đeo khẩu trang chuyên dụng.\n3. Đúng giờ hẹn và tư vấn tận tâm.',
                          );
                        },
                        onSupportCenterTap: () {
                          _showInfoDialog(
                            context,
                            title: 'Trung tâm hỗ trợ đối tác',
                            message: 'Vui lòng liên hệ đội ngũ hỗ trợ đối tác qua email partner@lambe.vn.',
                          );
                        },
                      ),
                    ],
                  ] else ...[
                    // Customer: Utilities & Settings
                    PartnerCustomerUtilitiesSection(
                      onEditProfileTap: () {
                        context.push('/profile/edit');
                      },
                      onPreferencesTap: () async {
                        await context.push('/profile/preferences');
                        ref.invalidate(serviceRecommendationsProvider);
                      },
                      onAddressTap: () {
                        context.push('/profile/address');
                      },
                      onNotificationSettingsTap: () =>
                          _handleNotificationSettings(context, ref),
                      onSupportCenterTap: () {
                        _showInfoDialog(
                          context,
                          title: 'Trung tâm trợ giúp Lambe',
                          message: 'Hỗ trợ khách hàng (8:00 - 22:00 hàng ngày) qua email cs@lambe.vn.',
                        );
                      },
                      onTermsTap: () {
                        _showInfoDialog(
                          context,
                          title: 'Điều khoản & Chính sách',
                          message: 'Lambe cam kết bảo mật tuyệt đối thông tin khách hàng và đảm bảo trải nghiệm làm đẹp 5 sao chuẩn mực.',
                        );
                      },
                    ),
                  ],

                  const SizedBox(height: 20),

                  // Partner Registration at bottom of Account screen for Customers
                  if (!isProvider) ...[
                    PartnerModeSwitchCard(
                      isProvider: isProvider,
                      isProviderMode: isProviderMode,
                      onSwitchTap: () => _handleModeSwitch(
                        context,
                        ref,
                        isProvider: isProvider,
                        isProviderMode: isProviderMode,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Logout & Version Footer
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

  Future<void> _handleModeSwitch(
    BuildContext context,
    WidgetRef ref, {
    required bool isProvider,
    required bool isProviderMode,
  }) async {
    if (!isProvider) {
      context.push('/partner/intro');
      return;
    }

    if (isProviderMode) {
      try {
        await ref.read(appModeControllerProvider).switchMode(AppMode.customer);
        if (context.mounted) context.go('/home');
      } catch (_) {
        if (context.mounted) {
          AppDialog.info(
            context,
            message:
                'Chưa thể chuyển sang chế độ Khách hàng. Vui lòng thử lại.',
          );
        }
      }
    } else {
      try {
        await ref.read(appModeControllerProvider).switchMode(AppMode.provider);
        if (context.mounted) context.go('/provider/home');
      } catch (_) {
        if (context.mounted) {
          AppDialog.info(
            context,
            message: 'Chưa thể chuyển sang chế độ Đối tác. Vui lòng thử lại.',
          );
        }
      }
    }
  }

  Future<void> _handleNotificationSettings(
    BuildContext context,
    WidgetRef ref,
  ) async {
    if (Firebase.apps.isEmpty) {
      if (context.mounted) {
        AppDialog.showMessageDialog(
          context,
          title: 'Cài đặt thông báo',
          message: 'Tính năng thông báo chỉ khả dụng trên thiết bị di động có cấu hình dịch vụ Firebase.',
        );
      }
      return;
    }
    final storage = ref.read(secureStorageProvider);
    final service = PushDeviceService(ref.read(dioProvider), storage);
    try {
      await storage.markPushPermissionExplained();
      await service.register();
      final status = await service.authorizationStatus();
      if (!context.mounted) return;
      final granted =
          status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional;
      await AppDialog.info(
        context,
        title: 'Cài đặt thông báo',
        message: granted
            ? 'Đã bật thông báo cho lịch hẹn và tin nhắn.'
            : 'Hãy bật thông báo cho Lambe trong cài đặt của điện thoại.',
      );
    } catch (_) {
      if (!context.mounted) return;
      await AppDialog.error(
        context,
        message: 'Chưa thể bật thông báo. Vui lòng thử lại.',
      );
    }
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
      await AppDialog.showErrorDialog(context, message: error);
    }
  }

  void _showInfoDialog(
    BuildContext context, {
    required String title,
    required String message,
  }) {
    AppDialog.showMessageDialog(context, title: title, message: message);
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirm = await AppDialog.showConfirmDialog(
      context,
      title: 'Đăng xuất tài khoản',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng Lambe?',
      confirmText: 'Đăng xuất',
    );

    if (confirm == true && context.mounted) {
      await logoutWithProviderCleanup(ref);
      if (context.mounted) {
        context.go('/auth');
      }
    }
  }
}
