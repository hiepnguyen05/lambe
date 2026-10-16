import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/theme/app_colors.dart';

class HomeHeaderAppBar extends StatelessWidget {
  final String locationName;
  final String? addressLine;
  final String? avatarUrl;
  final bool isGps;
  final VoidCallback? onLocationTap;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onProfileTap;

  const HomeHeaderAppBar({
    super.key,
    required this.locationName,
    this.addressLine,
    this.avatarUrl,
    this.isGps = false,
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
    return 'Đang xác định vị trí...';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: AppColors.surfaceContainerLowest.withValues(alpha: 0.85),
      surfaceTintColor: Colors.transparent,
      titleSpacing: 16,
      toolbarHeight: 64,
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color:
                      AppColors.surfaceContainerHighest.withValues(alpha: 0.35),
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
            width: 34,
            height: 34,
            padding: const EdgeInsets.all(5),
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
          const SizedBox(width: 8),
          // Location Selector
          Expanded(
            child: InkWell(
              onTap: onLocationTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isGps ? Icons.near_me_rounded : Icons.location_on_rounded,
                          size: 13,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          isGps
                              ? 'Vị trí GPS hiện tại'
                              : 'Giao đến • $locationName',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 1),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _displayAddress,
                            style: theme.textTheme.labelMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: AppColors.onSurface,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 16,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ],
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
            children: [
              // Nút chuông thông báo có chấm đỏ
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
                      minimumSize: const Size(40, 40),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
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
              const SizedBox(width: 4),
              // Nút Avatar cá nhân
              GestureDetector(
                onTap: onProfileTap,
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                  ),
                  child: ClipOval(
                    child: avatarUrl != null && avatarUrl!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: avatarUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => _buildAvatarFallback(),
                            errorWidget: (_, __, ___) =>
                                _buildAvatarFallback(),
                          )
                        : _buildAvatarFallback(),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAvatarFallback() {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.1),
      child: const Icon(
        Icons.person,
        size: 19,
        color: AppColors.primary,
      ),
    );
  }
}
