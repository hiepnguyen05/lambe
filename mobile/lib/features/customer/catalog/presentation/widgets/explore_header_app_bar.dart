import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';

class ExploreHeaderAppBar extends ConsumerWidget {
  final VoidCallback? onBackTap;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;

  const ExploreHeaderAppBar({
    super.key,
    this.onBackTap,
    this.onNotificationTap,
    this.onProfileTap,
  });

  static const String _defaultTemplateAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1XlDd36RzoNRw4CmBrXfYundsk_XsJ64LHBE_8HRWUUWz2FCiRs0eNNiIJiUe3ajWKXWgfshyY2q1mO0kaTYT6Mhj9NFdYzk7yanpouV-QOh1DIXzLlUaLaQd2yq9PwpwYx_yyLFTRuxLIJF1g-FCnC_OzrAJ2SA0tqTRr8CUt4dohrCoG2usAKNUJw_VGPSZEoJ4RxrAGLhl880UzL-PSws4MiBu-BEg3yO6xNW204pJ4ikZmphMwuCQ';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final resolvedAvatar =
        (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
        ? user.avatarUrl
        : _defaultTemplateAvatar;
    final userId = user?.id;
    final unreadOrdersCount = userId == null
        ? 0
        : ref.watch(totalUnreadNotificationsCountProvider);

    final canPop = Navigator.of(context).canPop();

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: AppColors.surface.withValues(alpha: 0.85),
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      toolbarHeight: 64,
      automaticallyImplyLeading: false,
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface.withValues(alpha: 0.85),
              border: Border(
                bottom: BorderSide(
                  color: AppColors.surfaceContainerHighest.withValues(
                    alpha: 0.35,
                  ),
                  width: 1,
                ),
              ),
            ),
          ),
        ),
      ),
      title: Row(
        children: [
          // Nút Back nếu được push từ màn khác
          if (canPop) ...[
            InkWell(
              onTap: onBackTap ?? () => context.pop(),
              borderRadius: BorderRadius.circular(100),
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerLowest,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.outlineVariant.withValues(alpha: 0.4),
                  ),
                ),
                child: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 16,
                  color: AppColors.onSurface,
                ),
              ),
            ),
            const SizedBox(width: 10),
          ],

          // Logo Lambe
          Container(
            width: 34,
            height: 34,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.outlineVariant.withValues(alpha: 0.35),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: SvgPicture.asset(
              'assets/images/logo.svg',
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 10),

          // Nhãn thương hiệu & Tiêu đề Khám Phá
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LAMBE BEAUTY',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 1),
                const Text(
                  'Khám Phá',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Nút chuông thông báo
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed:
                        onNotificationTap ??
                        () => context.push('/notifications'),
                    icon: const Icon(
                      Icons.notifications_none_rounded,
                      color: AppColors.onSurface,
                      size: 22,
                    ),
                    style: IconButton.styleFrom(
                      shape: const CircleBorder(),
                      minimumSize: const Size(36, 36),
                      padding: EdgeInsets.zero,
                    ),
                  ),
                  if (unreadOrdersCount > 0)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.secondary,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.surfaceContainerLowest,
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 6),

              // Avatar tròn người dùng
              InkWell(
                onTap: onProfileTap ?? () => context.go('/profile'),
                borderRadius: BorderRadius.circular(100),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: (resolvedAvatar != null && resolvedAvatar.isNotEmpty)
                        ? CachedNetworkImage(
                            imageUrl: resolvedAvatar,
                            width: 32,
                            height: 32,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              color: AppColors.surfaceContainerLow,
                              child: const Icon(
                                Icons.person_rounded,
                                size: 18,
                                color: AppColors.primary,
                              ),
                            ),
                            errorWidget: (_, __, ___) => Container(
                              color: AppColors.surfaceContainerLow,
                              child: const Icon(
                                Icons.person_rounded,
                                size: 18,
                                color: AppColors.primary,
                              ),
                            ),
                          )
                        : Container(
                            color: AppColors.surfaceContainerLow,
                            child: const Icon(
                              Icons.person_rounded,
                              size: 18,
                              color: AppColors.primary,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
