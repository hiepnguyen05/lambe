import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/feed_repository.dart';
import '../domain/feed_post.dart';
import '../domain/feed_scope.dart';
import 'feed_interactions_controller.dart';
import 'feed_error.dart';

class FeedDetailState {
  final FeedPost? post;
  final bool loading;
  final String? error;
  const FeedDetailState({this.post, this.loading = false, this.error});
}

class FeedDetailController extends StateNotifier<FeedDetailState> {
  final FeedRepository repository;
  final FeedInteractionsController signals;
  final FeedDetailScope scope;
  final bool signedIn;
  final cancel = CancelToken();
  FeedDetailController(this.repository, this.signals, this.scope, this.signedIn)
    : super(const FeedDetailState());
  Future<void> load() async {
    if (state.loading) return;
    final before = state.post, epoch = signals.epoch;
    state = FeedDetailState(post: before, loading: true);
    try {
      final value = await repository.detail(scope, cancel, signedIn: signedIn);
      if (!mounted) return;
      signals.ingest(value, epoch);
      state = FeedDetailState(post: value);
    } catch (error) {
      if (!mounted) return;
      final denied = const {403, 404}.contains(feedErrorStatus(error));
      if (denied && !scope.manage) signals.unavailable(scope.id);
      state = FeedDetailState(
        post: denied ? null : before,
        error: feedError(error),
      );
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
