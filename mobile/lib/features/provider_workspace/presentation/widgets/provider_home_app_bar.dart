import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../core/location/user_location_provider.dart';

class ProviderHomeAppBar extends ConsumerWidget {
  const ProviderHomeAppBar({super.key});

  String _getDisplayLocation(UserLocationModel location) {
    if (!location.isLoaded) {
      return 'Đang định vị...';
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
      final parts = [location.district, location.city]
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .toList();
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
                  color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
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
              border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
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
                if (!userLocation.serviceEnabled) {
                  await Geolocator.openLocationSettings();
                } else if (!userLocation.hasPermission) {
                  await Geolocator.openAppSettings();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đang làm mới vị trí GPS...'),
                      duration: Duration(milliseconds: 1200),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                  await ref.read(userLocationProvider.notifier).fetchLocation();
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
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed: () {},
                    icon: Icon(Icons.notifications_outlined, color: colorScheme.onSurfaceVariant),
                    style: IconButton.styleFrom(
                      backgroundColor: colorScheme.surfaceContainerLow,
                      shape: const CircleBorder(),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: colorScheme.surface, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: colorScheme.primary.withValues(alpha: 0.2), width: 2),
                  color: Colors.grey.shade200,
                ),
                child: const Icon(Icons.person, color: Colors.grey),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

