import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';

class HomeHeaderAppBar extends ConsumerWidget {
  final String locationName;
  final String? addressLine;
  final VoidCallback? onLocationTap;
  final VoidCallback? onNotificationTap;

  const HomeHeaderAppBar({
    super.key,
    required this.locationName,
    this.addressLine,
    this.onLocationTap,
    this.onNotificationTap,
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
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
            child: GuidanceAnchor(
              id: 'customer_location',
              child: InkWell(
                onTap: onLocationTap,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 2,
                    vertical: 2,
                  ),
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
          ),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 10),
          child: Stack(
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
        ),
      ],
    );
  }
}
