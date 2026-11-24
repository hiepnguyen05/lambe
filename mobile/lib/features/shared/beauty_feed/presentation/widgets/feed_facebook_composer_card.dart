import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

class FeedFacebookComposerCard extends ConsumerWidget {
  final VoidCallback? onComposeTap;

  const FeedFacebookComposerCard({super.key, this.onComposeTap});

  static const String _defaultAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1UxQ-Aczi5XaaYBFygitYU4Vp5Nh0i43Lgy60hvgcYifgJ_tDQyJAQryF7P_mS2tMyAvSIkNndG2nF9QijX7CWMDEAjO2tSa0nT_l-Lh-WHmHxc2o_mm52MR0WvASv3MWMl3nXPluk0Ab5LNVECv0I5uaYEZiwbfuNBD8P0BqSLIVQQizrXoykkzuBWWd978AV8AqWJyq9USf1fdolKE5A71uIB-74Ma9vPg7mpJOvammh5_HqRCzcnpQ';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final avatarUrl = (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
        ? user.avatarUrl!
        : _defaultAvatar;

    void openComposer() {
      if (onComposeTap != null) {
        onComposeTap!();
      } else {
        context.push('/feed/compose');
      }
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.surfaceContainerHighest.withValues(alpha: 0.5),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Row 1: Avatar + Facebook-style fake input prompt
          Row(
            children: [
              // Partner Avatar
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceContainerLow,
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    width: 1.5,
                  ),
                ),
                child: ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: avatarUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => const Icon(
                      Icons.person_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                    errorWidget: (_, __, ___) => const Icon(
                      Icons.person_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Fake Input Field ("Bạn muốn chia sẻ tác phẩm nào?")
              Expanded(
                child: InkWell(
                  onTap: openComposer,
                  borderRadius: BorderRadius.circular(100),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Text(
                      'Chia sẻ tác phẩm làm đẹp mới...',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),
          Divider(
            height: 1,
            thickness: 0.8,
            color: AppColors.surfaceContainerHighest.withValues(alpha: 0.45),
          ),
          const SizedBox(height: 6),

          // Row 2: Facebook-style quick media action buttons
          Row(
            children: [
              _buildQuickAction(
                icon: Icons.photo_library_rounded,
                iconColor: const Color(0xFF45BD62), // FB Photo Green
                label: 'Ảnh/Video',
                onTap: openComposer,
              ),
              _buildQuickAction(
                icon: Icons.auto_awesome_rounded,
                iconColor: AppColors.primary,
                label: 'Dịch vụ',
                onTap: openComposer,
              ),
              _buildQuickAction(
                icon: Icons.edit_note_rounded,
                iconColor: const Color(0xFF1877F2), // FB Blue
                label: 'Đăng bài',
                onTap: openComposer,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAction({
    required IconData icon,
    required Color iconColor,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: iconColor,
                ),
                const SizedBox(width: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

