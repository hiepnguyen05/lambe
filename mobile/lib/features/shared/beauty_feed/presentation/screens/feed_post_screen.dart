import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/feed_providers.dart';
import '../../domain/feed_scope.dart';
import '../widgets/feed_post_card.dart';
import '../widgets/feed_feedback.dart';
import '../widgets/feed_engagement_tracker.dart';
import '../widgets/feed_appeal_form.dart';

class FeedPostScreen extends ConsumerStatefulWidget {
  final String id;
  final bool manage;
  const FeedPostScreen({super.key, required this.id, this.manage = false});
  @override
  ConsumerState<FeedPostScreen> createState() => _FeedPostScreenState();
}

class _FeedPostScreenState extends ConsumerState<FeedPostScreen>
    with WidgetsBindingObserver {
  FeedDetailScope get scope =>
      FeedDetailScope(widget.id, manage: widget.manage);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ModalRoute.of(context)?.isCurrent == true) {
      ref.read(feedDetailProvider(scope).notifier).load();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedDetailProvider(scope)),
        notifier = ref.read(feedDetailProvider(scope).notifier);
    final mutation = widget.manage
        ? ref.watch(feedPublisherProvider(widget.id))
        : null;
    final hidden = ref.watch(
      feedSignalsProvider.select(
        (s) => widget.manage
            ? s.deleted.contains(widget.id)
            : s.unavailable.contains(widget.id),
      ),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.manage ? 'Quản lý bài đăng' : 'Tác phẩm làm đẹp'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/feed'),
        ),
        actions: [
          if (widget.manage && state.post != null && !hidden) ...[
            IconButton(
              tooltip: 'Sửa bài',
              icon: const Icon(Icons.edit_outlined),
              onPressed: mutation?.busy == true || mutation?.uncertain == true
                  ? null
                  : () => context.push('/feed/posts/${widget.id}/edit'),
            ),
            IconButton(
              tooltip: 'Xóa bài',
              icon: const Icon(Icons.delete_outline),
              onPressed: mutation?.busy == true || mutation?.uncertain == true
                  ? null
                  : () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Xóa bài đăng?'),
                          content: const Text(
                            'Bài sẽ được rút khỏi Feed; lịch sử tương tác được hệ thống lưu theo chính sách.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Giữ lại'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Xóa bài'),
                            ),
                          ],
                        ),
                      );
                      if (confirm != true || !context.mounted) return;
                      final success = await ref
                          .read(feedPublisherProvider(widget.id).notifier)
                          .remove(widget.id);
                      if (success && context.mounted) {
                        context.go('/feed?mode=mine');
                      }
                    },
            ),
          ],
        ],
      ),
      body: RefreshIndicator(
        onRefresh: notifier.load,
        child: ListView(
          padding: const EdgeInsets.all(12),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (widget.manage &&
                state.post?.moderationStatus == 'REJECTED' &&
                !hidden)
              FeedAppealForm(
                key: ValueKey('${widget.id}:${state.post!.revision}'),
                postId: widget.id,
                revision: state.post!.revision,
              ),
            SizedBox(
              height: 3,
              child: state.loading || mutation?.busy == true
                  ? const LinearProgressIndicator()
                  : null,
            ),
            if (state.error != null)
              FeedFeedback(state.error!, retry: notifier.load),
            if (mutation?.error != null)
              FeedFeedback(
                mutation!.error!,
                retry: () async {
                  await notifier.load();
                  if (mounted) {
                    ref
                        .read(feedPublisherProvider(widget.id).notifier)
                        .beginNewIntent();
                  }
                },
              ),
            if (state.post != null && !hidden)
              FeedEngagementTracker(
                key: ValueKey('${widget.id}:${widget.manage}'),
                postId: widget.id,
                enabled: !widget.manage,
                reporter: ref.watch(feedEngagementReporterProvider),
                child: FeedPostCard(
                  post: state.post!,
                  detail: true,
                  manage: widget.manage,
                ),
              )
            else if (!state.loading)
              FeedFeedback(
                'Bài đăng không còn khả dụng trong phạm vi này.',
                retry: notifier.load,
              ),
          ],
        ),
      ),
    );
  }
}
