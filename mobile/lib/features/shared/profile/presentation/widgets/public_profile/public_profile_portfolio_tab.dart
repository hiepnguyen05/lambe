import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/beauty_feed/di/feed_providers.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_post.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_post_card.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class PublicProfilePortfolioTab extends ConsumerStatefulWidget {
  final PartnerPublicProfileEntity profile;

  const PublicProfilePortfolioTab({
    super.key,
    required this.profile,
  });

  @override
  ConsumerState<PublicProfilePortfolioTab> createState() =>
      _PublicProfilePortfolioTabState();
}

class _PublicProfilePortfolioTabState
    extends ConsumerState<PublicProfilePortfolioTab> {
  bool _isGridView = true;

  void _showPortfolioDetail(
    BuildContext context,
    PublicPortfolioItemEntity item,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Container(
            color: AppColors.surfaceContainerLowest,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (item.imageUrl.isNotEmpty)
                  AspectRatio(
                    aspectRatio: 1,
                    child: CachedNetworkImage(
                      imageUrl: item.imageUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: AppColors.surfaceContainer,
                        child: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: AppColors.surfaceContainer,
                        child: const Icon(
                          Icons.broken_image_outlined,
                          size: 40,
                          color: AppColors.outline,
                        ),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (item.title.isNotEmpty) ...[
                        Text(
                          item.title,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.favorite_rounded,
                                size: 16,
                                color: Color(0xFFEF4444),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${item.likesCount} lượt yêu thích',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Đóng'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final feedScope = FeedScope(providerId: widget.profile.id);
    final feedState = ref.watch(feedListProvider(feedScope));
    final feedPosts = feedState.items;
    final portfolio = widget.profile.portfolio;

    final hasFeedPosts = feedPosts.isNotEmpty;
    final hasPortfolio = portfolio.isNotEmpty;
    final totalCount = hasFeedPosts ? feedPosts.length : portfolio.length;

    if (!hasFeedPosts && !hasPortfolio) {
      if (feedState.loading) {
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: Center(
            child: CircularProgressIndicator(
              color: AppColors.primary,
              strokeWidth: 2.5,
            ),
          ),
        );
      }

      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Column(
          children: [
            Icon(
              Icons.photo_library_outlined,
              size: 48,
              color: AppColors.outline,
            ),
            SizedBox(height: 12),
            Text(
              'Chuyên viên chưa đăng tải hình ảnh nhật ký tác phẩm.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with Title & Dual View Mode Switcher
        Row(
          children: [
            const Icon(
              Icons.collections_bookmark_outlined,
              size: 18,
              color: AppColors.primary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'Nhật ký làm đẹp ($totalCount tác phẩm)',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
            ),
            if (hasFeedPosts) ...[
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.outlineVariant.withValues(alpha: 0.35),
                    width: 1,
                  ),
                ),
                padding: const EdgeInsets.all(2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildViewModeButton(
                      isSelected: _isGridView,
                      icon: Icons.grid_view_rounded,
                      tooltip: 'Xem dạng lưới',
                      onTap: () => setState(() => _isGridView = true),
                    ),
                    _buildViewModeButton(
                      isSelected: !_isGridView,
                      icon: Icons.view_agenda_rounded,
                      tooltip: 'Xem dạng bảng tin',
                      onTap: () => setState(() => _isGridView = false),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),

        // Body: Feed View (List) or Grid View (Grid)
        if (!hasFeedPosts)
          _buildPortfolioFallbackGrid(portfolio)
        else if (!_isGridView)
          _buildFeedListView(feedPosts)
        else
          _buildFeedGridView(feedPosts),
      ],
    );
  }

  Widget _buildViewModeButton({
    required bool isSelected,
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(
            icon,
            size: 15,
            color: isSelected ? Colors.white : AppColors.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  Widget _buildFeedListView(List<FeedPost> feedPosts) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: feedPosts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final post = feedPosts[index];
        return FeedPostCard(post: post);
      },
    );
  }

  Widget _buildFeedGridView(List<FeedPost> feedPosts) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: feedPosts.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 4 / 5,
      ),
      itemBuilder: (context, index) {
        final post = feedPosts[index];
        final firstMedia = post.media.isNotEmpty ? post.media.first : null;
        final hasVideo = post.media.any((m) => m.video);
        final hasMultipleMedia = post.media.length > 1;

        return GestureDetector(
          onTap: () => context.push('/feed/posts/${post.id}'),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (firstMedia != null && firstMedia.url.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: firstMedia.url,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      color: AppColors.surfaceContainer,
                      child: const Icon(
                        Icons.image_outlined,
                        color: AppColors.outlineVariant,
                      ),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: AppColors.surfaceContainer,
                      child: const Icon(
                        Icons.broken_image_outlined,
                        color: AppColors.outline,
                      ),
                    ),
                  )
                else
                  Container(
                    color: AppColors.surfaceContainer,
                    child: const Icon(
                      Icons.image_outlined,
                      color: AppColors.outline,
                    ),
                  ),

                // Video Indicator Badge
                if (hasVideo)
                  Positioned(
                    top: 5,
                    right: 5,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        size: 13,
                        color: Colors.white,
                      ),
                    ),
                  )
                else if (hasMultipleMedia)
                  Positioned(
                    top: 5,
                    right: 5,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.copy_rounded,
                            size: 10,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            '+${post.media.length}',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Bottom Likes Counter gradient
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.7),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.favorite_rounded,
                          size: 11,
                          color: Color(0xFFEF4444),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '${post.likes}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPortfolioFallbackGrid(List<PublicPortfolioItemEntity> portfolio) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: portfolio.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 4 / 5,
      ),
      itemBuilder: (context, index) {
        final item = portfolio[index];
        return GestureDetector(
          onTap: () => _showPortfolioDetail(context, item),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (item.imageUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: item.imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      color: AppColors.surfaceContainer,
                      child: const Icon(
                        Icons.image_outlined,
                        color: AppColors.outlineVariant,
                      ),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: AppColors.surfaceContainer,
                      child: const Icon(
                        Icons.image_outlined,
                        color: AppColors.outline,
                      ),
                    ),
                  )
                else
                  Container(
                    color: AppColors.surfaceContainer,
                    child: const Icon(
                      Icons.image_outlined,
                      color: AppColors.outline,
                    ),
                  ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.7),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.favorite_rounded,
                          size: 11,
                          color: Color(0xFFEF4444),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          '${item.likesCount}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
