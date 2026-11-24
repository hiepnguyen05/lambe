import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class PublicProfileHeroCard extends StatefulWidget {
  final PartnerPublicProfileEntity profile;
  final VoidCallback? onChatTap;
  final VoidCallback? onFollowTap;
  final bool isFollowing;

  const PublicProfileHeroCard({
    super.key,
    required this.profile,
    this.onChatTap,
    this.onFollowTap,
    this.isFollowing = false,
  });

  @override
  State<PublicProfileHeroCard> createState() => _PublicProfileHeroCardState();
}

class _PublicProfileHeroCardState extends State<PublicProfileHeroCard> {
  late bool _isFollowing;

  @override
  void initState() {
    super.initState();
    _isFollowing = widget.isFollowing;
  }

  @override
  void didUpdateWidget(covariant PublicProfileHeroCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isFollowing != widget.isFollowing) {
      _isFollowing = widget.isFollowing;
    }
  }

  void _handleShare(BuildContext context) {
    AppDialog.info(
      context,
      title: 'Chia sẻ hồ sơ',
      message:
          'Đã sao chép liên kết hồ sơ của chuyên viên ${widget.profile.displayName}. Bạn có thể gửi cho bạn bè!',
      buttonText: 'Đã hiểu',
    );
  }

  void _handleToggleFollow() {
    setState(() {
      _isFollowing = !_isFollowing;
    });
    if (widget.onFollowTap != null) {
      widget.onFollowTap!();
    } else {
      AppDialog.info(
        context,
        title: _isFollowing ? 'Đang theo dõi' : 'Đã bỏ theo dõi',
        message: _isFollowing
            ? 'Bạn sẽ nhận được thông báo về ưu đãi và nhật ký mới từ chuyên viên ${widget.profile.displayName}.'
            : 'Bạn đã hủy theo dõi chuyên viên ${widget.profile.displayName}.',
        buttonText: 'Đồng ý',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;
    final specialtyText = profile.categories.isNotEmpty
        ? 'Chuyên viên ${profile.categories.join(' & ')} • ${profile.experienceYears} năm KN'
        : 'Chuyên viên đối tác Lambe • ${profile.experienceYears} năm KN';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.2),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Ambient teal gradient corner
          Positioned(
            top: -24,
            right: -24,
            child: Container(
              width: 110,
              height: 110,
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
                // Top row: Avatar + Primary Info
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar with verified badge
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.surfaceContainer,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: ClipOval(
                            child: profile.avatarUrl != null &&
                                    profile.avatarUrl!.isNotEmpty
                                ? Image.network(
                                    profile.avatarUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        _buildAvatarFallback(profile.displayName),
                                  )
                                : _buildAvatarFallback(profile.displayName),
                          ),
                        ),
                        // Verified KYC Badge (chuẩn theo mẫu)
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.surfaceContainerLowest,
                                width: 2,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withValues(alpha: 0.35),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.verified_rounded,
                              color: Colors.white,
                              size: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    // Names and meta
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile.displayName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.onSurface,
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            specialtyText,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.onSurfaceVariant,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_rounded,
                                size: 15,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 3),
                              Expanded(
                                child: Text(
                                  '${profile.serviceRadiusKm} km quanh ${profile.serviceAreaName}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
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

                // Trust Badges Carousel
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildTrustChip(
                        icon: Icons.hotel_class_rounded,
                        label: 'Đối tác Vàng ${profile.rating.toStringAsFixed(1)}',
                        backgroundColor:
                            AppColors.secondaryContainer.withValues(alpha: 0.5),
                        textColor: AppColors.onSecondaryContainer,
                      ),
                      const SizedBox(width: 8),
                      _buildTrustChip(
                        icon: Icons.verified_user_rounded,
                        label: 'Đã xác thực CCCD & Bằng cấp',
                        backgroundColor:
                            AppColors.primaryContainer.withValues(alpha: 0.12),
                        textColor: AppColors.primary,
                      ),
                      const SizedBox(width: 8),
                      _buildTrustChip(
                        icon: Icons.sanitizer_rounded,
                        label: 'Tiệt trùng chuẩn UV 100%',
                        backgroundColor: AppColors.surfaceContainer,
                        textColor: AppColors.onSurfaceVariant,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // Performance Stats Grid (4 cols)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _buildStatItem(
                          label: 'Đánh giá',
                          value: profile.rating.toStringAsFixed(1),
                          unit: '★',
                          subText: '(${profile.reviewCount})',
                          valueColor: const Color(0xFFD97706),
                        ),
                      ),
                      _buildStatDivider(),
                      Expanded(
                        child: _buildStatItem(
                          label: 'Đơn xong',
                          value: '${profile.completedOrdersCount}+',
                        ),
                      ),
                      _buildStatDivider(),
                      Expanded(
                        child: _buildStatItem(
                          label: 'Nhận đơn',
                          value: '${profile.acceptanceRate.toStringAsFixed(0)}%',
                        ),
                      ),
                      _buildStatDivider(),
                      Expanded(
                        child: _buildStatItem(
                          label: 'Đúng giờ',
                          value: '${profile.onTimeRate.toStringAsFixed(0)}%',
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // Quick Action Buttons Row (Chuẩn logic theo HTML mẫu)
                Row(
                  children: [
                    // Nút Theo dõi (chiếm toàn bộ phần còn lại)
                    Expanded(
                      child: Material(
                        color: _isFollowing
                            ? AppColors.primary
                            : AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(22),
                        child: InkWell(
                          onTap: _handleToggleFollow,
                          borderRadius: BorderRadius.circular(22),
                          child: Container(
                            height: 44,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  _isFollowing
                                      ? Icons.check_circle_rounded
                                      : Icons.person_add_rounded,
                                  size: 18,
                                  color: _isFollowing
                                      ? Colors.white
                                      : AppColors.onSurface,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  _isFollowing ? 'Đang theo dõi' : '+ Theo dõi',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: _isFollowing
                                        ? Colors.white
                                        : AppColors.onSurface,
                                    height: 1.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Nút Nhắn tin tư vấn (nút tròn 44x44)
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        color: AppColors.surfaceContainer,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        onPressed: widget.onChatTap ??
                            () {
                              AppDialog.info(
                                context,
                                title: 'Nhắn tin tư vấn',
                                message:
                                    'Tính năng trò chuyện trực tiếp với chuyên viên ${profile.displayName} đang được kết nối với phiên đặt hẹn.',
                                buttonText: 'Đã rõ',
                              );
                            },
                        icon: const Icon(
                          Icons.chat_bubble_rounded,
                          size: 19,
                          color: AppColors.primary,
                        ),
                        tooltip: 'Nhắn tin tư vấn',
                        padding: EdgeInsets.zero,
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Nút Chia sẻ hồ sơ (nút tròn 44x44)
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        color: AppColors.surfaceContainer,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        onPressed: () => _handleShare(context),
                        icon: const Icon(
                          Icons.ios_share_rounded,
                          size: 20,
                          color: AppColors.onSurface,
                        ),
                        tooltip: 'Chia sẻ hồ sơ',
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'L';
    return Container(
      color: AppColors.primary.withValues(alpha: 0.1),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildTrustChip({
    required IconData icon,
    required String label,
    required Color backgroundColor,
    required Color textColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required String label,
    required String value,
    String? unit,
    String? subText,
    Color? valueColor,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: valueColor ?? AppColors.onSurface,
              ),
            ),
            if (unit != null) ...[
              const SizedBox(width: 1),
              Text(
                unit,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? AppColors.onSurface,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            subText != null ? '$label $subText' : label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.onSurfaceVariant,
            ),
            maxLines: 1,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildStatDivider() {
    return Container(
      height: 24,
      width: 1,
      color: AppColors.outlineVariant.withValues(alpha: 0.4),
      margin: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}
