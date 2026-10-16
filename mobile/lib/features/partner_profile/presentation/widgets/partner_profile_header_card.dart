import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/partner_profile_entity.dart';

class PartnerProfileHeaderCard extends StatelessWidget {
  final PartnerProfileEntity profile;
  final VoidCallback? onViewPublicProfileTap;

  const PartnerProfileHeaderCard({
    super.key,
    required this.profile,
    this.onViewPublicProfileTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final partnerCode = profile.id.isNotEmpty
        ? '#${profile.id.length > 7 ? profile.id.substring(0, 7).toUpperCase() : profile.id.toUpperCase()}'
        : '#LAMBE';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.antiAlias,
        children: [
          // Background soft teal glow decoration
          Positioned(
            top: -24,
            right: -24,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primaryContainer.withValues(alpha: 0.12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar + Name + Badges row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar with verified badge
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.surfaceContainer,
                              width: 2,
                            ),
                            color: AppColors.surfaceContainerLow,
                          ),
                          child: ClipOval(
                            child:
                                profile.avatarUrl != null &&
                                    profile.avatarUrl!.isNotEmpty
                                ? Image.network(
                                    profile.avatarUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        _buildAvatarFallback(),
                                  )
                                : _buildAvatarFallback(),
                          ),
                        ),
                        if (profile.isVerified)
                          Positioned(
                            bottom: -2,
                            right: -2,
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.surfaceContainerLowest,
                                  width: 2,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.1),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.verified,
                                color: AppColors.onPrimary,
                                size: 13,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    // Name, specialty, ratings
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  profile.displayName,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 17,
                                    color: AppColors.onSurface,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceContainer,
                                  borderRadius: BorderRadius.circular(100),
                                ),
                                child: Text(
                                  partnerCode,
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: AppColors.tertiary,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            profile.biography,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.onSurfaceVariant,
                              fontSize: 12,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 8),
                          // Badges: Rating & KYC
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              if (profile.rating != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFDBC8)
                                        .withValues(alpha: 0.6),
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.star_rounded,
                                        size: 14,
                                        color: AppColors.secondary,
                                      ),
                                      const SizedBox(width: 2),
                                      Text(
                                        profile.rating!.toStringAsFixed(2),
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                              color: const Color(0xFF321200),
                                            ),
                                      ),
                                      if (profile.reviewCount != null) ...[
                                        const SizedBox(width: 2),
                                        Text(
                                          '(${profile.reviewCount})',
                                          style: theme.textTheme.labelSmall
                                              ?.copyWith(
                                                color: AppColors
                                                    .onSurfaceVariant
                                                    .withValues(alpha: 0.75),
                                                fontSize: 10,
                                              ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              if (profile.isVerified)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceContainerLow,
                                    borderRadius: BorderRadius.circular(100),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: const BoxDecoration(
                                          color: AppColors.primary,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Đã xác minh',
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 10,
                                              color: AppColors.primary,
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
                ),
                const SizedBox(height: 14),
                // Public profile button
                InkWell(
                  onTap: onViewPublicProfileTap,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.visibility_outlined,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Xem hồ sơ công khai (Khách xem)',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          color: AppColors.outline,
                          size: 14,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarFallback() {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.1),
      child: const Icon(Icons.person, size: 34, color: AppColors.primary),
    );
  }
}
