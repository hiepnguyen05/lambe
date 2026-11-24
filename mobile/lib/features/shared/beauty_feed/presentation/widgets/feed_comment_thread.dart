import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../domain/feed_comment.dart';
import '../../di/feed_providers.dart';
import '../../application/feed_error.dart';

class FeedCommentThread extends ConsumerStatefulWidget {
  final String postId;
  final FeedComment parent;
  final ValueChanged<FeedComment> reply;
  final ValueChanged<String> remove;
  const FeedCommentThread({
    super.key,
    required this.postId,
    required this.parent,
    required this.reply,
    required this.remove,
  });
  @override
  ConsumerState<FeedCommentThread> createState() => _FeedCommentThreadState();
}

class _FeedCommentThreadState extends ConsumerState<FeedCommentThread> {
  final _cancel = CancelToken();
  late List<FeedComment> _replies;
  String? _cursor, _error;
  bool _more = false, _loading = false;
  int _generation = 0;
  @override
  void initState() {
    super.initState();
    _reset();
  }

  void _reset() {
    _generation++;
    _loading = false;
    _error = null;
    _replies = widget.parent.replies;
    _more = widget.parent.replyCount > _replies.length;
    _cursor = _replies.isEmpty ? null : _replies.last.id;
  }

  @override
  void didUpdateWidget(covariant FeedCommentThread oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.parent != widget.parent) _reset();
  }

  Future<void> _load() async {
    if (_loading) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(feedRepositoryProvider)
          .comments(
            widget.postId,
            _cancel,
            parentId: widget.parent.id,
            cursor: _cursor,
          );
      if (!mounted || generation != _generation) return;
      final unique = {for (final reply in _replies) reply.id: reply};
      for (final reply in page.items) {
        unique[reply.id] = reply;
      }
      setState(() {
        _replies = unique.values.toList(growable: false);
        _cursor = page.cursor;
        _more = page.cursor != null;
      });
    } catch (error) {
      if (mounted && generation == _generation) {
        setState(() {
          _error = feedError(error);
          if (feedErrorStatus(error) == 400) {
            _cursor = null;
            _replies = [];
          }
          if (const {403, 404}.contains(feedErrorStatus(error))) {
            _more = false;
            _replies = [];
          }
        });
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'Vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút';
    if (diff.inHours < 24) return '${diff.inHours} giờ';
    if (diff.inDays < 7) return '${diff.inDays} ngày';
    return '${dt.day}/${dt.month}';
  }

  Widget _tile(FeedComment comment, String? userId, {required bool root}) {
    final isOwn = comment.user.id == userId;
    final avatarSize = root ? 34.0 : 26.0;

    return Padding(
      padding: EdgeInsets.only(top: 6, bottom: 6, left: root ? 0 : 36),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: avatarSize,
            height: avatarSize,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surfaceContainerLow,
              border: Border.all(
                color: AppColors.outlineVariant.withValues(alpha: 0.3),
                width: 0.8,
              ),
            ),
            child: ClipOval(
              child:
                  (comment.user.avatar != null &&
                      comment.user.avatar!.isNotEmpty)
                  ? CachedNetworkImage(
                      imageUrl: comment.user.avatar!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Icon(
                        Icons.person,
                        size: avatarSize * 0.6,
                        color: AppColors.onSurfaceVariant,
                      ),
                      errorWidget: (_, __, ___) => Icon(
                        Icons.person,
                        size: avatarSize * 0.6,
                        color: AppColors.onSurfaceVariant,
                      ),
                    )
                  : Icon(
                      Icons.person,
                      size: avatarSize * 0.6,
                      color: AppColors.onSurfaceVariant,
                    ),
            ),
          ),
          const SizedBox(width: 8),

          // Comment Bubble & Meta
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Bubble Container
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // User Name
                      Text(
                        comment.user.name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),

                      // Comment text or tombstone
                      Text(
                        comment.deleted
                            ? 'Bình luận đã xóa'
                            : (comment.text ?? ''),
                        style: TextStyle(
                          fontSize: 13.5,
                          height: 1.35,
                          fontStyle: comment.deleted
                              ? FontStyle.italic
                              : FontStyle.normal,
                          color: comment.deleted
                              ? AppColors.onSurfaceVariant.withValues(
                                  alpha: 0.65,
                                )
                              : AppColors.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),

                // Meta row: Time, Reply action, Delete action
                Padding(
                  padding: const EdgeInsets.only(left: 6, top: 4),
                  child: Row(
                    children: [
                      Text(
                        _formatTime(comment.createdAt),
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppColors.onSurfaceVariant.withValues(
                            alpha: 0.7,
                          ),
                        ),
                      ),
                      if (root && !comment.deleted) ...[
                        const SizedBox(width: 14),
                        GestureDetector(
                          onTap: () => widget.reply(widget.parent),
                          behavior: HitTestBehavior.opaque,
                          child: const Text(
                            'Trả lời',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                      if (isOwn && !comment.deleted) ...[
                        const SizedBox(width: 10),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 16),
                          tooltip: 'Xóa bình luận',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 24,
                            minHeight: 24,
                          ),
                          color: AppColors.onSurfaceVariant,
                          onPressed: () => widget.remove(comment.id),
                        ),
                      ],
                      if (!isOwn && userId != null && !comment.deleted)
                        PopupMenuButton<String>(
                          tooltip: 'Báo cáo bình luận',
                          iconSize: 16,
                          onSelected: (reason) async {
                            try {
                              await ref
                                  .read(feedRepositoryProvider)
                                  .reportComment(comment.id, reason, _cancel);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Đã gửi báo cáo bình luận.'),
                                  ),
                                );
                              }
                            } catch (_) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Chưa gửi được báo cáo. Hãy thử lại.',
                                    ),
                                  ),
                                );
                              }
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'SPAM', child: Text('Spam')),
                            PopupMenuItem(
                              value: 'INAPPROPRIATE',
                              child: Text('Nội dung không phù hợp'),
                            ),
                            PopupMenuItem(
                              value: 'PRIVACY',
                              child: Text('Xâm phạm quyền riêng tư'),
                            ),
                            PopupMenuItem(
                              value: 'MISLEADING',
                              child: Text('Thông tin sai lệch'),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(
      authNotifierProvider.select((v) => v.valueOrNull?.id),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tile(widget.parent, userId, root: true),
        Padding(
          padding: const EdgeInsets.only(left: 24),
          child: Column(
            children: [
              for (final reply in _replies) _tile(reply, userId, root: false),
            ],
          ),
        ),
        if (_error != null) Text(_error!),
        if (_more)
          TextButton(
            onPressed: _loading ? null : _load,
            child: Text(_loading ? 'Đang tải…' : 'Xem thêm phản hồi'),
          ),
        const Divider(),
      ],
    );
  }

  @override
  void dispose() {
    _cancel.cancel();
    super.dispose();
  }
}
