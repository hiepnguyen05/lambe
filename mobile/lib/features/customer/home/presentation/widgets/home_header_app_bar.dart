import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';

class HomeHeaderAppBar extends ConsumerWidget {
  final String locationName;
  final String? addressLine;
  final String? avatarUrl;
  final VoidCallback? onLocationTap;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;

  const HomeHeaderAppBar({
    super.key,
    required this.locationName,
    this.addressLine,
    this.avatarUrl,
    this.onLocationTap,
    this.onNotificationTap,
    this.onProfileTap,
  });

  String get _displayAddress {
    if (addressLine != null &&
        addressLine!.isNotEmpty &&
        addressLine != 'Vị trí hiện tại') {
      return addressLine!;
    }
    if (locationName.isNotEmpty && locationName != 'Vị trí hiện tại') {
      return locationName;
    }
    return 'Chưa xác định địa chỉ';
  }

  static const String _defaultTemplateAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1XlDd36RzoNRw4CmBrXfYundsk_XsJ64LHBE_8HRWUUWz2FCiRs0eNNiIJiUe3ajWKXWgfshyY2q1mO0kaTYT6Mhj9NFdYzk7yanpouV-QOh1DIXzLlUaLaQd2yq9PwpwYx_yyLFTRuxLIJF1g-FCnC_OzrAJ2SA0tqTRr8CUt4dohrCoG2usAKNUJw_VGPSZEoJ4RxrAGLhl880UzL-PSws4MiBu-BEg3yO6xNW204pJ4ikZmphMwuCQ';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final resolvedAvatar = (avatarUrl != null && avatarUrl!.isNotEmpty)
        ? avatarUrl
        : ((user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
            ? user.avatarUrl
            : _defaultTemplateAvatar);
    final userId = user?.id;
    final unreadOrdersCount = userId == null
        ? 0
        : ref.watch(totalUnreadNotificationsCountProvider);

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: AppColors.surface.withValues(alpha: 0.85),
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      toolbarHeight: 64,
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
          // Logo Lambe
          Container(
            width: 32,
            height: 32,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.outlineVariant.withValues(alpha: 0.35),
              ),
            ),
            child: SvgPicture.asset(
              'assets/images/logo.svg',
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 10),
          // Location Button: 2 dòng (Dòng 1: Vị trí hiện tại, Dòng 2: Tên địa chỉ chi tiết)
          Flexible(
            child: InkWell(
              onTap: onLocationTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.location_on_rounded,
                          size: 13,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 3),
                        Flexible(
                          child: Text(
                            (locationName.isNotEmpty &&
                                    locationName != 'Đang định vị...' &&
                                    locationName != 'Vị trí hiện tại')
                                ? locationName
                                : 'Vị trí hiện tại',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                              letterSpacing: -0.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 14,
                          color: AppColors.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      _displayAddress,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.onSurface,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Nút chuông thông báo
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed: onNotificationTap,
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
