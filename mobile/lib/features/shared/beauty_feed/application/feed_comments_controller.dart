import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/feed_repository.dart';
import '../domain/feed_comment.dart';
import 'feed_error.dart';

class FeedCommentsState {
  final List<FeedComment> items;
  final String? cursor, error;
  final bool loading, loaded, sending, uncertain;
  const FeedCommentsState({
    this.items = const [],
    this.cursor,
    this.error,
    this.loading = false,
    this.loaded = false,
    this.sending = false,
    this.uncertain = false,
  });
}

class FeedCommentsController extends StateNotifier<FeedCommentsState> {
  final FeedRepository repository;
  final String postId;
  final cancel = CancelToken();
  int _generation = 0;
  FeedCommentsController(this.repository, this.postId)
    : super(const FeedCommentsState());
  Future<void> load({bool refresh = false}) async {
    if (state.sending ||
        (!refresh &&
            (state.loading || (state.loaded && state.cursor == null)))) {
      return;
    }
    final generation = refresh ? ++_generation : _generation;
    final before = state;
    state = FeedCommentsState(
      items: before.items,
      cursor: before.cursor,
      loaded: before.loaded,
      loading: true,
      uncertain: before.uncertain,
    );
    try {
      final page = await repository.comments(
        postId,
        cancel,
        cursor: refresh ? null : before.cursor,
      );
      if (!mounted || generation != _generation) return;
      final items = <String, FeedComment>{
        for (final item in refresh ? <FeedComment>[] : before.items)
          item.id: item,
      };
      for (final item in page.items) {
        items[item.id] = item;
      }
      state = FeedCommentsState(
        items: items.values.toList(growable: false),
        cursor: page.cursor,
        loaded: true,
        uncertain: refresh ? false : before.uncertain,
      );
    } catch (error) {
      if (mounted && generation == _generation) {
        state = FeedCommentsState(
          items: const {403, 404}.contains(feedErrorStatus(error))
              ? const []
              : before.items,
          cursor: const {400, 403, 404}.contains(feedErrorStatus(error))
              ? null
              : before.cursor,
          loaded: before.loaded,
          uncertain: before.uncertain,
          error: feedError(error),
        );
      }
    }
  }

  Future<bool> send(String text, {String? parentId}) async {
    if (state.sending || state.loading || state.uncertain) return false;
    if (text.trim().isEmpty || text.trim().runes.length > 1000) return false;
    final before = state;
    state = FeedCommentsState(
      items: before.items,
      cursor: before.cursor,
      loaded: before.loaded,
      sending: true,
    );
    try {
      await repository.comment(postId, text, cancel, parentId: parentId);
      if (!mounted) return false;
      state = FeedCommentsState(
        items: before.items,
        cursor: before.cursor,
        loaded: before.loaded,
      );
      await load(refresh: true);
      return true;
    } catch (error) {
      if (mounted) {
        state = FeedCommentsState(
          items: before.items,
          cursor: before.cursor,
          loaded: before.loaded,
          uncertain: feedUncertain(error),
          error: feedError(error),
        );
      }
      return false;
    }
  }

  Future<void> remove(String commentId) async {
    if (state.sending || state.loading || state.uncertain) return;
    final before = state;
    state = FeedCommentsState(
      items: before.items,
      cursor: before.cursor,
      loaded: before.loaded,
      sending: true,
    );
    try {
      await repository.deleteComment(postId, commentId, cancel);
      if (!mounted) return;
      state = FeedCommentsState(
        items: before.items,
        cursor: before.cursor,
        loaded: before.loaded,
      );
      await load(refresh: true);
    } catch (error) {
      if (mounted) {
        state = FeedCommentsState(
          items: before.items,
          cursor: before.cursor,
          loaded: before.loaded,
          uncertain: feedUncertain(error),
          error: feedError(error),
        );
      }
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
