import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/feed_local_cache.dart';

import '../data/feed_repository.dart';
import '../domain/feed_scope.dart';
import '../domain/feed_post.dart';
import 'feed_interactions_controller.dart';
import 'feed_error.dart';

class FeedListState {
  final List<FeedPost> items;
  final String? cursor, error;
  final bool loading, loaded, invalidCursor, cached;
  const FeedListState({
    this.items = const [],
    this.cursor,
    this.error,
    this.loading = false,
    this.loaded = false,
    this.invalidCursor = false,
    this.cached = false,
  });
}

class FeedListController extends StateNotifier<FeedListState> {
  final FeedRepository repository;
  final FeedInteractionsController signals;
  final FeedScope scope;
  final bool signedIn;
  final FeedLocalCache? local;
  final cancel = CancelToken();
  int _generation = 0;
  FeedListController(
    this.repository,
    this.signals,
    this.scope,
    this.signedIn, {
    this.local,
  }) : super(const FeedListState());
  Future<void> load({bool refresh = false}) async {
    if (!signedIn && scope.mode != FeedMode.all) {
      state = const FeedListState(
        loaded: true,
        error: 'Hãy đăng nhập để xem danh sách này.',
      );
      return;
    }
    if (!refresh &&
        (state.loading ||
            state.invalidCursor ||
            (state.loaded && state.cursor == null))) {
      return;
    }
    final generation = refresh ? ++_generation : _generation;
    if (!state.loaded && !state.loading && scope.mode == FeedMode.all) {
      state = FeedListState(
        items: state.items,
        loading: true,
        cached: state.cached,
      );
      final cached = await local?.read(scope) ?? <FeedPost>[];
      if (!mounted || generation != _generation) return;
      if (cached.isNotEmpty) state = FeedListState(items: cached, cached: true);
    }
    final before = state, epoch = signals.epoch;
    state = FeedListState(
      items: before.items,
      cursor: before.cursor,
      loaded: before.loaded,
      loading: true,
      cached: before.cached,
    );
    try {
      final page = await repository.list(
        scope,
        cancel,
        signedIn: signedIn,
        cursor: refresh ? null : before.cursor,
      );
      if (!mounted || generation != _generation) return;
      final items = <String, FeedPost>{
        for (final item in refresh ? <FeedPost>[] : before.items) item.id: item,
      };
      for (final item in page.items) {
        items[item.id] = item;
        signals.ingest(item, epoch);
      }
      state = FeedListState(
        items: items.values.toList(growable: false),
        cursor: page.cursor,
        loaded: true,
      );
      if (refresh || before.cursor == null) {
        await local?.write(scope, page.items);
      }
    } catch (error) {
      if (!mounted || generation != _generation) return;
      final badCursor =
          !refresh && before.cursor != null && feedErrorStatus(error) == 400;
      state = FeedListState(
        items: before.items,
        cursor: before.cursor,
        loaded: before.loaded,
        invalidCursor: badCursor,
        error: badCursor
            ? 'Danh sách đã thay đổi. Hãy tải lại từ đầu.'
            : feedError(error),
        cached: before.cached,
      );
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
