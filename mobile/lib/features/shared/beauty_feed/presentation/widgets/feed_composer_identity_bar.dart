import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class FeedComposerIdentityBar extends StatelessWidget {
  final String displayName;
  final String? avatarUrl;
  final String? memberId;

  const FeedComposerIdentityBar({
    super.key,
    required this.displayName,
    this.avatarUrl,
    this.memberId,
  });

  static const String _defaultAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1UxQ-Aczi5XaaYBFygitYU4Vp5Nh0i43Lgy60hvgcYifgJ_tDQyJAQryF7P_mS2tMyAvSIkNndG2nF9QijX7CWMDEAjO2tSa0nT_l-Lh-WHmHxc2o_mm52MR0WvASv3MWMl3nXPluk0Ab5LNVECv0I5uaYEZiwbfuNBD8P0BqSLIVQQizrXoykkzuBWWd978AV8AqWJyq9USf1fdolKE5A71uIB-74Ma9vPg7mpJOvammh5_HqRCzcnpQ';

  @override
  Widget build(BuildContext context) {
    final isWorker = memberId != null && memberId!.isNotEmpty;
    final url = (avatarUrl != null && avatarUrl!.isNotEmpty)
        ? avatarUrl!
        : _defaultAvatar;

    return Row(
      children: [
        // Avatar with subtle primary ring
        Container(
          width: 44,
          height: 44,
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
              imageUrl: url,
              fit: BoxFit.cover,
              placeholder: (_, __) => const Icon(
                Icons.person_rounded,
                color: AppColors.primary,
                size: 22,
              ),
              errorWidget: (_, __, ___) => const Icon(
                Icons.person_rounded,
                color: AppColors.primary,
                size: 22,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Name and Scope badge
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                displayName.isNotEmpty ? displayName : 'Đối tác Lambe',
                style: const TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                  letterSpacing: -0.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),

              // Scope Badge
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: isWorker
                          ? AppColors.hotBadgeBg
                          : AppColors.primaryFixed.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(
                        color: isWorker
                            ? AppColors.hotBadgeText.withValues(alpha: 0.3)
                            : AppColors.primary.withValues(alpha: 0.2),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isWorker
                              ? Icons.verified_user_outlined
                              : Icons.public_rounded,
                          size: 12,
                          color: isWorker
                              ? AppColors.hotBadgeText
                              : AppColors.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isWorker
                              ? 'Cơ sở phê duyệt trước'
                              : 'Công khai toàn hệ thống',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isWorker
                                ? AppColors.hotBadgeText
                                : AppColors.primary,
                          ),
                        ),
                      ],
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

