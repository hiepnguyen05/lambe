import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/chat/di/chat_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/shared/notifications/presentation/providers/notifications_providers.dart';

class ProviderHomeAppBar extends ConsumerWidget {
  const ProviderHomeAppBar({super.key});

  String _getDisplayLocation(UserLocationModel location) {
    if (!location.isLoaded) {
      return 'Chạm để cập nhật vị trí';
    }
    if (!location.serviceEnabled) {
      return 'Chưa bật GPS (chạm để bật)';
    }
    if (!location.hasPermission) {
      return 'Chưa cấp quyền (chạm để cấp)';
    }
    if (location.addressLine.isNotEmpty &&
        location.addressLine != 'Vị trí hiện tại') {
      return location.addressLine;
    }
    if (location.district != null || location.city != null) {
      final parts = [
        location.district,
        location.city,
      ].whereType<String>().where((s) => s.isNotEmpty).toList();
      if (parts.isNotEmpty) {
        return parts.join(', ');
      }
    }
    return '${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final userLocation = ref.watch(userLocationProvider);
    final unreadMessagesCount = ref.watch(
      chatInboxNotifierProvider('provider').select((s) => s.totalUnreadCount),
    );
    final userId = ref.watch(authNotifierProvider).valueOrNull?.id;
    final unreadOrdersCount = userId == null
        ? 0
        : ref.watch(totalUnreadNotificationsCountProvider);

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: colorScheme.surface.withValues(alpha: 0.9),
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      toolbarHeight: 64,
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: colorScheme.surfaceContainerHighest.withValues(
                    alpha: 0.4,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      title: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: colorScheme.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            child: SvgPicture.asset(
              'assets/images/logo.svg',
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              onTap: () async {
                try {
                  final position = await ref
                      .read(providerLocationCoordinatorProvider)
                      .capture(requestPermission: true);
                  await ref
                      .read(userLocationProvider.notifier)
                      .updateAddressForPosition(position);
                } catch (error) {
                  if (context.mounted) {
                    AppDialog.error(
                      context,
                      message: error is StateError
                          ? error.message.toString()
                          : 'Chưa lấy được vị trí. Hãy kiểm tra quyền định vị.',
                    );
                  }
                }
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.near_me_rounded,
                          size: 13,
                          color: colorScheme.primary,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          'Vị trí hiện tại',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colorScheme.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Icon(
                          Icons.refresh_rounded,
                          size: 11,
                          color: colorScheme.primary.withValues(alpha: 0.7),
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      _getDisplayLocation(userLocation),
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: colorScheme.onSurface,
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
          padding: const EdgeInsets.only(right: 16),
          child: Row(
            children: [
              // Nút tin nhắn chat thay cho Avatar
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed: () => context.push('/provider/messages'),
                    icon: Icon(
                      Icons.chat_bubble_outline_rounded,
                      color: colorScheme.onSurfaceVariant,
                      size: 21,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: colorScheme.surfaceContainerLow,
                      shape: const CircleBorder(),
                      minimumSize: const Size(40, 40),
                    ),
                  ),
                  if (unreadMessagesCount > 0)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFF0F766E),
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          unreadMessagesCount > 99
                              ? '99+'
                              : '$unreadMessagesCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 8),
              // Nút chuông thông báo
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed: () => context.push('/notifications'),
                    icon: Icon(
                      Icons.notifications_outlined,
                      color: colorScheme.onSurfaceVariant,
                      size: 22,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: colorScheme.surfaceContainerLow,
                      shape: const CircleBorder(),
                      minimumSize: const Size(40, 40),
                    ),
                  ),
                  if (unreadOrdersCount > 0)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: colorScheme.primary,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: colorScheme.surface,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
