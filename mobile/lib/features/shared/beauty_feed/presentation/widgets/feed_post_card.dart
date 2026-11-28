import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../di/feed_providers.dart';
import '../../application/feed_interactions_controller.dart';
import '../../domain/feed_post.dart';
import 'feed_booking_actions.dart';
import 'feed_comments_bottom_sheet.dart';
import 'feed_media_gallery.dart';
import 'feed_report_dialog.dart';

class FeedPostCard extends ConsumerStatefulWidget {
  final FeedPost post;
  final bool detail, manage;

  const FeedPostCard({
    super.key,
    required this.post,
    this.detail = false,
    this.manage = false,
  });

  @override
  ConsumerState<FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends ConsumerState<FeedPostCard> {
  bool _isExpanded = false;

  String _formatTimeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes.clamp(1, 60)} phút trước';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} giờ trước';
    } else if (diff.inDays < 7) {
      return diff.inDays == 1 ? 'Hôm qua' : '${diff.inDays} ngày trước';
    } else {
      return '${dt.day}/${dt.month}/${dt.year}';
    }
  }

  Future<void> _sharePost(BuildContext context) async {
    try {
      final box = context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(
        ShareParams(
          text:
              '${widget.post.provider.name} trên Lambe\nlambe://app/feed/posts/${widget.post.id}\n(Cần cài ứng dụng Lambe để mở)',
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (_) {
      if (context.mounted) {
        await AppDialog.error(context, message: 'Chưa mở được bảng chia sẻ.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final detail = widget.detail;
    final manage = widget.manage;

    final currentUserId = ref.watch(authNotifierProvider).valueOrNull?.id;
    final isProvider = ref.watch(
      authNotifierProvider.select(
        (v) => v.valueOrNull?.roles.contains('PROVIDER') == true,
      ),
    );
    final myProviderId = isProvider
        ? ref.watch(feedPublishingContextProvider).valueOrNull?.providerId
        : null;

    final isOwnPost =
        manage ||
        post.managed ||
        (myProviderId != null && post.provider.id == myProviderId) ||
        (currentUserId != null &&
            (post.provider.id == currentUserId ||
                post.author?.id == currentUserId));

    final reaction =
        ref.watch(feedSignalsProvider.select((s) => s.posts[post.id])) ??
        FeedReaction.of(post);
    final followed =
        ref.watch(
          feedSignalsProvider.select((s) => s.follows[post.provider.id]),
        ) ??
        post.followed;

    bool watchBlocked(String kind, String id) => ref.watch(
      feedSignalsProvider.select(
        (s) => s.busy.contains('$kind:$id') || s.unknown.contains('$kind:$id'),
      ),
    );

    final likeBlocked = watchBlocked('like', post.id),
        saveBlocked = watchBlocked('save', post.id),
        followBlocked = watchBlocked('follow', post.provider.id);

    Future<void> toggle(String kind) async {
      final error = await ref
          .read(feedSignalsProvider.notifier)
          .toggle(post, kind);
      if (error != null && context.mounted) {
        await AppDialog.error(context, message: error);
      }
    }

    bool blocked(String kind) => kind == 'like'
        ? likeBlocked
        : kind == 'save'
        ? saveBlocked
        : followBlocked;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Partner Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                // Avatar with Verified Tick Badge
                GestureDetector(
                  onTap: () =>
                      context.push('/providers/${post.provider.id}/public'),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.surfaceContainerLow,
                        ),
                        child: ClipOval(
                          child:
                              post.provider.avatar != null &&
                                  post.provider.avatar!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: post.provider.avatar!,
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
                                )
                              : const Icon(
                                  Icons.person_rounded,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                        ),
                      ),
                      Positioned(
                        bottom: -1,
                        right: -1,
                        child: Container(
                          padding: const EdgeInsets.all(1.5),
                          decoration: const BoxDecoration(
                            color: AppColors.surfaceContainerLowest,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified_rounded,
                            size: 14,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),

                // Name & Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              post.provider.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14.5,
                                color: AppColors.onSurface,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 5,
                              vertical: 1.5,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.secondaryContainer.withValues(
                                alpha: 0.7,
                              ),
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.star_rounded,
                                  size: 10,
                                  color: AppColors.onSecondaryContainer,
                                ),
                                SizedBox(width: 1.5),
                                Text(
                                  '5',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.onSecondaryContainer,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        post.author != null
                            ? 'Bởi ${post.author!.name} • ${_formatTimeAgo(post.createdAt)}'
                            : 'Chuyên gia Lambe • ${_formatTimeAgo(post.createdAt)}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Follow button & 3 dots option
                if (!isOwnPost) ...[
                  InkWell(
                    onTap: blocked('follow') ? null : () => toggle('follow'),
                    borderRadius: BorderRadius.circular(100),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: followed
                            ? AppColors.surfaceContainer
                            : AppColors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            followed ? Icons.check_rounded : Icons.add_rounded,
                            size: 13,
                            color: followed
                                ? AppColors.onSurfaceVariant
                                : AppColors.primary,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            followed ? 'Đang theo dõi' : 'Theo dõi',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: followed
                                  ? AppColors.onSurfaceVariant
                                  : AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 2),
                ],

                // 3 dots more options
                IconButton(
                  onPressed: () => showFeedReport(context, post.id),
                  icon: const Icon(
                    Icons.more_horiz_rounded,
                    size: 20,
                    color: AppColors.outline,
                  ),
                  tooltip: 'Tùy chọn',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                ),
              ],
            ),
          ),

          // 2. Caption section (Placed ABOVE media frame, Facebook style)
          if (post.caption.isNotEmpty || manage)
            Padding(
              padding: const EdgeInsets.only(left: 14, right: 14, bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (post.caption.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        if (!detail) {
                          setState(() => _isExpanded = !_isExpanded);
                        }
                      },
                      child: Text(
                        post.caption,
                        maxLines: (detail || _isExpanded) ? null : 3,
                        overflow: (detail || _isExpanded)
                            ? null
                            : TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13.5,
                          height: 1.4,
                          color: AppColors.onSurface,
                        ),
                      ),
                    ),

                  // Moderate/Management Notes if in manage mode
                  if (manage) ...[
                    if (post.caption.isNotEmpty) const SizedBox(height: 8),
                    Text(
                      post.moderationLabel,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                    if (post.organizationNote != null)
                      Text(
                        'Phản hồi tổ chức: ${post.organizationNote}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    if (post.moderationNote != null)
                      Text('Phản hồi nền tảng: ${post.moderationNote}'),
                  ],
                ],
              ),
            ),

          // 3. Media Carousel (4:3 ratio)
          FeedMediaGallery(post: post, managed: manage),

          // 4. Attached Service Tag Card (Booking action)
          if (post.services.isNotEmpty && !manage)
            Padding(
              padding: const EdgeInsets.only(left: 14, right: 14, top: 12),
              child: FeedBookingActions(post: post),
            ),

          // 5. Interaction Bar (Like, Comment, Save, Share)
          if (!manage) ...[
            Padding(
              padding: const EdgeInsets.only(
                left: 10,
                right: 10,
                top: 8,
                bottom: 8,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Row(
                        children: [
                          // Like Button
                          InkWell(
                            onTap: blocked('like')
                                ? null
                                : () => toggle('like'),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 6,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    reaction.liked
                                        ? Icons.favorite_rounded
                                        : Icons.favorite_border_rounded,
                                    size: 20,
                                    color: reaction.liked
                                        ? AppColors.error
                                        : AppColors.onSurfaceVariant,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${reaction.likes} Thích',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: reaction.liked
                                          ? AppColors.error
                                          : AppColors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 2),

                          // Comment Button (Facebook-style bottom sheet)
                          InkWell(
                            onTap: () => FeedCommentsBottomSheet.show(
                              context,
                              postId: post.id,
                            ),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 6,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                    size: 19,
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${post.comments} Bình luận',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 2),

                          // Save / Bookmark Button
                          InkWell(
                            onTap: blocked('save')
                                ? null
                                : () => toggle('save'),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 6,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    reaction.saved
                                        ? Icons.bookmark_rounded
                                        : Icons.bookmark_border_rounded,
                                    size: 20,
                                    color: reaction.saved
                                        ? AppColors.primary
                                        : AppColors.onSurfaceVariant,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Lưu',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: reaction.saved
                                          ? AppColors.primary
                                          : AppColors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Share Button
                  IconButton(
                    onPressed: () => _sharePost(context),
                    icon: const Icon(
                      Icons.share_outlined,
                      size: 20,
                      color: AppColors.onSurfaceVariant,
                    ),
                    tooltip: 'Chia sẻ',
                    style: IconButton.styleFrom(
                      padding: const EdgeInsets.all(6),
                      minimumSize: const Size(36, 36),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
