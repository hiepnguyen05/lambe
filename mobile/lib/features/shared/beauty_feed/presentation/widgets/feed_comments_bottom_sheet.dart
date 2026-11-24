import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import '../../di/feed_providers.dart';
import '../../domain/feed_comment.dart';
import 'feed_comment_thread.dart';
import 'feed_feedback.dart';

class FeedCommentsBottomSheet extends ConsumerStatefulWidget {
  final String postId;

  const FeedCommentsBottomSheet({super.key, required this.postId});

  static Future<void> show(BuildContext context, {required String postId}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      builder: (context) => FeedCommentsBottomSheet(postId: postId),
    );
  }

  @override
  ConsumerState<FeedCommentsBottomSheet> createState() =>
      _FeedCommentsBottomSheetState();
}

class _FeedCommentsBottomSheetState
    extends ConsumerState<FeedCommentsBottomSheet> {
  final TextEditingController _text = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  FeedComment? _reply;

  static const String _defaultAvatar =
      'https://lh3.googleusercontent.com/aida/AEtjO1UxQ-Aczi5XaaYBFygitYU4Vp5Nh0i43Lgy60hvgcYifgJ_tDQyJAQryF7P_mS2tMyAvSIkNndG2nF9QijX7CWMDEAjO2tSa0nT_l-Lh-WHmHxc2o_mm52MR0WvASv3MWMl3nXPluk0Ab5LNVECv0I5uaYEZiwbfuNBD8P0BqSLIVQQizrXoykkzuBWWd978AV8AqWJyq9USf1fdolKE5A71uIB-74Ma9vPg7mpJOvammh5_HqRCzcnpQ';

  @override
  void dispose() {
    _text.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submitComment() async {
    final text = _text.text.trim();
    if (text.isEmpty) return;

    final controller =
        ref.read(feedCommentsProvider(widget.postId).notifier);
    final success = await controller.send(
      text,
      parentId: _reply?.id,
    );
    if (success && mounted) {
      _text.clear();
      setState(() => _reply = null);
      _focusNode.unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authNotifierProvider.select((v) => v.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next && mounted) {
        setState(() {
          _text.clear();
          _reply = null;
        });
      }
    });

    final state = ref.watch(feedCommentsProvider(widget.postId));
    final controller =
        ref.read(feedCommentsProvider(widget.postId).notifier);

    final user = ref.watch(authNotifierProvider).valueOrNull;
    final userAvatar =
        (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
            ? user.avatarUrl!
            : _defaultAvatar;

    final viewInsets = MediaQuery.of(context).viewInsets;
    final screenHeight = MediaQuery.of(context).size.height;

    return Container(
      height: screenHeight * 0.8,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // 1. Top Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 38,
              height: 4.5,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // 2. Header Bar: Title + Close Button
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 2, 8, 8),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Bình luận',
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 22),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Đóng',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
              ],
            ),
          ),
          Divider(
            height: 1,
            thickness: 0.8,
            color: AppColors.surfaceContainerHigh.withValues(alpha: 0.7),
          ),

          // 3. Status indicator & error notice
          if (state.loading)
            const LinearProgressIndicator(
              minHeight: 2.5,
              color: AppColors.primary,
              backgroundColor: Colors.transparent,
            ),
          if (state.error != null)
            FeedFeedback(
              state.error!,
              retry: () => controller.load(refresh: true),
            ),
          if (state.uncertain)
            const Padding(
              padding: EdgeInsets.all(10),
              child: Text(
                'Chưa rõ bình luận đã gửi thành công hay chưa. Vui lòng tải lại trang.',
                style: TextStyle(fontSize: 12.5, color: AppColors.error),
              ),
            ),

          // 4. Scrollable Comments List
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => controller.load(refresh: true),
              child: state.items.isEmpty && !state.loading
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        Padding(
                          padding: EdgeInsets.symmetric(
                            vertical: 48,
                            horizontal: 24,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 48,
                                color: AppColors.onSurfaceVariant,
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Chưa có bình luận nào.',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.onSurface,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Hãy là người đầu tiên chia sẻ cảm nghĩ về tác phẩm này!',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      itemCount: state.items.length + (state.cursor != null ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == state.items.length) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Center(
                              child: TextButton(
                                onPressed:
                                    state.loading ? null : () => controller.load(),
                                child: const Text(
                                  'Xem thêm bình luận',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }

                        final comment = state.items[index];
                        return FeedCommentThread(
                          key: ValueKey(comment.id),
                          postId: widget.postId,
                          parent: comment,
                          reply: (parent) {
                            setState(() => _reply = parent);
                            _focusNode.requestFocus();
                          },
                          remove: (id) async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Xóa bình luận?'),
                                content: const Text(
                                  'Bình luận này sẽ bị xóa khỏi bài viết.',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, false),
                                    child: const Text('Giữ lại'),
                                  ),
                                  FilledButton(
                                    onPressed: () => Navigator.pop(ctx, true),
                                    child: const Text('Xóa'),
                                  ),
                                ],
                              ),
                            );
                            if (confirm == true && mounted && controller.mounted) {
                              await controller.remove(id);
                            }
                          },
                        );
                      },
                    ),
            ),
          ),

          // 5. Replying indicator (if replying to someone)
          if (_reply != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              color: AppColors.surfaceContainerLow,
              child: Row(
                children: [
                  const Icon(
                    Icons.reply_rounded,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Đang trả lời ${_reply!.user.name}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                    onPressed: () => setState(() => _reply = null),
                  ),
                ],
              ),
            ),

          // 6. Facebook-style Pinned Comment Input Bar (Keyboard-Aware)
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border(
                top: BorderSide(
                  color: AppColors.surfaceContainerHighest.withValues(alpha: 0.6),
                  width: 0.8,
                ),
              ),
            ),
            padding: EdgeInsets.fromLTRB(
              12,
              8,
              8,
              viewInsets.bottom > 0 ? viewInsets.bottom + 8 : 14,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // User Avatar
                Container(
                  width: 34,
                  height: 34,
                  margin: const EdgeInsets.only(bottom: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surfaceContainerLow,
                    border: Border.all(
                      color: AppColors.outlineVariant.withValues(alpha: 0.35),
                    ),
                  ),
                  child: ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: userAvatar,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => const Icon(
                        Icons.person,
                        size: 18,
                        color: AppColors.onSurfaceVariant,
                      ),
                      errorWidget: (_, __, ___) => const Icon(
                        Icons.person,
                        size: 18,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Text Input Pill
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: AppColors.surfaceContainerHighest.withValues(
                          alpha: 0.6,
                        ),
                        width: 0.8,
                      ),
                    ),
                    child: TextField(
                      controller: _text,
                      focusNode: _focusNode,
                      enabled: !state.sending && !state.uncertain,
                      maxLength: 1000,
                      buildCounter: (
                        _, {
                        required currentLength,
                        required isFocused,
                        maxLength,
                      }) =>
                          null,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.onSurface,
                        height: 1.3,
                      ),
                      decoration: const InputDecoration(
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        hintText: 'Viết bình luận công khai...',
                        hintStyle: TextStyle(
                          fontSize: 13.5,
                          color: AppColors.onSurfaceVariant,
                          fontWeight: FontWeight.normal,
                        ),
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 9,
                        ),
                      ),
                      onChanged: (val) => setState(() {}),
                    ),
                  ),
                ),
                const SizedBox(width: 4),

                // Send Button
                IconButton(
                  icon: Icon(
                    Icons.send_rounded,
                    size: 20,
                    color: (_text.text.trim().isNotEmpty &&
                            !state.sending &&
                            !state.uncertain)
                        ? AppColors.primary
                        : AppColors.onSurfaceVariant.withValues(alpha: 0.35),
                  ),
                  tooltip: 'Gửi bình luận',
                  onPressed: (_text.text.trim().isNotEmpty &&
                          !state.sending &&
                          !state.uncertain)
                      ? _submitComment
                      : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

