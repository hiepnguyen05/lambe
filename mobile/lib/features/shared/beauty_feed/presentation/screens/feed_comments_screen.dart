import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../di/feed_providers.dart';
import '../../domain/feed_comment.dart';
import '../widgets/feed_feedback.dart';
import '../widgets/feed_comment_thread.dart';

class FeedCommentsScreen extends ConsumerStatefulWidget {
  final String postId;
  const FeedCommentsScreen({super.key, required this.postId});
  @override
  ConsumerState<FeedCommentsScreen> createState() => _FeedCommentsScreenState();
}

class _FeedCommentsScreenState extends ConsumerState<FeedCommentsScreen> {
  final _text = TextEditingController();
  FeedComment? _reply;
  @override
  Widget build(BuildContext context) {
    ref.listen(authNotifierProvider.select((v) => v.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next) {
        setState(() {
          _text.clear();
          _reply = null;
        });
      }
    });
    final state = ref.watch(feedCommentsProvider(widget.postId)),
        controller = ref.read(feedCommentsProvider(widget.postId).notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('Bình luận')),
      body: Column(
        children: [
          SizedBox(
            height: 3,
            child: state.loading ? const LinearProgressIndicator() : null,
          ),
          if (state.error != null)
            FeedFeedback(
              state.error!,
              retry: () => controller.load(refresh: true),
            ),
          if (state.uncertain)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'Chưa rõ bình luận đã được gửi hay chưa. Tải lại và kiểm tra trước khi gửi thêm.',
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => controller.load(refresh: true),
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: state.items.length + 1,
                itemBuilder: (context, index) {
                  if (index == state.items.length) {
                    return state.cursor != null
                        ? TextButton(
                            onPressed: state.loading
                                ? null
                                : () => controller.load(),
                            child: const Text('Xem thêm bình luận'),
                          )
                        : state.items.isEmpty && !state.loading
                        ? const FeedFeedback('Chưa có bình luận.')
                        : const SizedBox.shrink();
                  }
                  return FeedCommentThread(
                    key: ValueKey(state.items[index].id),
                    postId: widget.postId,
                    parent: state.items[index],
                    reply: (parent) => setState(() => _reply = parent),
                    remove: (id) async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Xóa bình luận của bạn?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Giữ lại'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(context, true),
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
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_reply != null)
                    Row(
                      children: [
                        Expanded(child: Text('Trả lời ${_reply!.user.name}')),
                        IconButton(
                          onPressed: () => setState(() => _reply = null),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
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
                              hintText: 'Viết bình luận...',
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
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        tooltip: 'Gửi bình luận',
                        onPressed:
                            state.sending || state.loading || state.uncertain
                            ? null
                            : () async {
                                final success = await controller.send(
                                  _text.text,
                                  parentId: _reply?.id,
                                );
                                if (success && context.mounted) {
                                  _text.clear();
                                  setState(() => _reply = null);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Đã gửi bình luận.'),
                                    ),
                                  );
                                }
                              },
                        icon: state.sending
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(),
                              )
                            : const Icon(Icons.send_outlined),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }
}
