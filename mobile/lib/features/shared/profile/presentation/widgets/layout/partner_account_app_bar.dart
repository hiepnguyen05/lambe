import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:mobile/core/theme/app_colors.dart';

class PartnerAccountAppBar extends StatelessWidget {
  final String? avatarUrl;
  final String? badgeLabel;
  final VoidCallback? onNotificationTap;

  const PartnerAccountAppBar({
    super.key,
    this.avatarUrl,
    this.badgeLabel,
    this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

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
              border: Border(
                bottom: BorderSide(
                  color: AppColors.surfaceContainerHighest.withValues(
                    alpha: 0.4,
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
          Container(
            width: 34,
            height: 34,
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.outlineVariant.withValues(alpha: 0.4),
              ),
            ),
            child: SvgPicture.asset(
              'assets/images/logo.svg',
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                badgeLabel ?? 'LAMBE',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 10,
                  color: AppColors.primary,
                  letterSpacing: 1.0,
                ),
              ),
              Text(
                'Tài Khoản',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Row(
            children: [
              IconButton(
                onPressed: onNotificationTap ?? () {},
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: AppColors.onSurfaceVariant,
                  size: 22,
                ),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.surfaceContainerLow,
                  shape: const CircleBorder(),
                  minimumSize: const Size(40, 40),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    width: 1.5,
                  ),
                ),
                child: ClipOval(
                  child: avatarUrl != null && avatarUrl!.isNotEmpty
                      ? Image.network(
                          avatarUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _buildFallbackAvatar(),
                        )
                      : _buildFallbackAvatar(),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFallbackAvatar() {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.1),
      child: const Icon(Icons.person, size: 20, color: AppColors.primary),
    );
  }
}
