import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/feed_repository.dart';
import '../domain/feed_post.dart';
import '../domain/feed_scope.dart';
import 'feed_error.dart';

class FeedReaction extends Equatable {
  final bool liked, saved;
  final int likes, saves;
  const FeedReaction(this.liked, this.saved, this.likes, this.saves);
  factory FeedReaction.of(FeedPost value) =>
      FeedReaction(value.liked, value.saved, value.likes, value.saves);
  @override
  List<Object?> get props => [liked, saved, likes, saves];
}

class FeedSignals {
  final Map<String, FeedReaction> posts;
  final Map<String, bool> follows;
  final Set<String> busy, unknown, unavailable, deleted;
  const FeedSignals({
    this.posts = const {},
    this.follows = const {},
    this.busy = const {},
    this.unknown = const {},
    this.unavailable = const {},
    this.deleted = const {},
  });
  FeedSignals copy({
    Map<String, FeedReaction>? posts,
    Map<String, bool>? follows,
    Set<String>? busy,
    Set<String>? unknown,
    Set<String>? unavailable,
    Set<String>? deleted,
  }) => FeedSignals(
    posts: posts ?? this.posts,
    follows: follows ?? this.follows,
    busy: busy ?? this.busy,
    unknown: unknown ?? this.unknown,
    unavailable: unavailable ?? this.unavailable,
    deleted: deleted ?? this.deleted,
  );
}

class FeedInteractionsController extends StateNotifier<FeedSignals> {
  final FeedRepository repository;
  final cancel = CancelToken();
  final _versions = <String, int>{};
  int _epoch = 0;
  int get epoch => _epoch;
  FeedInteractionsController(this.repository) : super(const FeedSignals());
  void ingest(FeedPost post, int readEpoch) {
    if (!mounted || post.managed) return;
    final previous = state.posts[post.id] ?? FeedReaction.of(post);
    bool keep(String kind, String id) =>
        state.busy.contains('$kind:$id') ||
        (_versions['$kind:$id'] ?? 0) > readEpoch;
    final like = keep('like', post.id),
        save = keep('save', post.id),
        follow = keep('follow', post.provider.id);
    final unknown = {...state.unknown};
    for (final key in [
      'like:${post.id}',
      'save:${post.id}',
      'follow:${post.provider.id}',
    ]) {
      if (!state.busy.contains(key) && (_versions[key] ?? 0) <= readEpoch) {
        unknown.remove(key);
      }
    }
    state = state.copy(
      posts: {
        ...state.posts,
        post.id: FeedReaction(
          like ? previous.liked : post.liked,
          save ? previous.saved : post.saved,
          like ? previous.likes : post.likes,
          save ? previous.saves : post.saves,
        ),
      },
      follows: {
        ...state.follows,
        post.provider.id: follow
            ? (state.follows[post.provider.id] ?? post.followed)
            : post.followed,
      },
      unknown: unknown,
      unavailable: (_versions['visibility:${post.id}'] ?? 0) <= readEpoch
          ? ({...state.unavailable}..remove(post.id))
          : state.unavailable,
    );
  }

  void markChanged(FeedPost post) {
    _versions['visibility:${post.id}'] = ++_epoch;
    state = state.copy(
      unavailable: post.published
          ? state.unavailable
          : {...state.unavailable, post.id},
    );
  }

  void unavailable(String id, {bool deleted = false}) {
    if (!mounted) return;
    _versions['visibility:$id'] = ++_epoch;
    state = state.copy(
      unavailable: {...state.unavailable, id},
      deleted: deleted ? {...state.deleted, id} : state.deleted,
    );
  }

  void _set(
    FeedPost post,
    String kind,
    bool enabled, {
    FeedReaction? restore,
    bool? restoreFollow,
  }) {
    final current = state.posts[post.id] ?? FeedReaction.of(post);
    if (kind == 'follow') {
      state = state.copy(
        follows: {...state.follows, post.provider.id: restoreFollow ?? enabled},
      );
    } else {
      final liked = kind == 'like'
          ? (restore?.liked ?? enabled)
          : current.liked;
      final saved = kind == 'save'
          ? (restore?.saved ?? enabled)
          : current.saved;
      final likes = kind == 'like'
          ? (restore?.likes ??
                (current.likes +
                        (liked == current.liked
                            ? 0
                            : liked
                            ? 1
                            : -1))
                    .clamp(0, 1 << 53))
          : current.likes;
      final saves = kind == 'save'
          ? (restore?.saves ??
                (current.saves +
                        (saved == current.saved
                            ? 0
                            : saved
                            ? 1
                            : -1))
                    .clamp(0, 1 << 53))
          : current.saves;
      state = state.copy(
        posts: {
          ...state.posts,
          post.id: FeedReaction(liked, saved, likes.toInt(), saves.toInt()),
        },
      );
    }
  }

  Future<String?> toggle(FeedPost post, String kind) async {
    final id = kind == 'follow' ? post.provider.id : post.id,
        key = '$kind:${kind == 'follow' ? post.provider.id : post.id}';
    if (state.busy.contains(key) || state.unknown.contains(key)) {
      return 'Hãy tải lại trạng thái trước khi thao tác tiếp.';
    }
    final prior = state.posts[post.id] ?? FeedReaction.of(post);
    final priorFollow = state.follows[post.provider.id] ?? post.followed;
    final enabled = !(kind == 'like'
        ? prior.liked
        : kind == 'save'
        ? prior.saved
        : priorFollow);
    _versions[key] = ++_epoch;
    state = state.copy(busy: {...state.busy, key});
    _set(post, kind, enabled);
    try {
      final receipt = await repository.react(id, kind, enabled, cancel);
      if (receipt != enabled) {
        throw const FormatException('Kết quả tương tác không khớp.');
      }
      if (!mounted) return null;
      _versions[key] = ++_epoch;
      return null;
    } catch (error) {
      if (!mounted) return null;
      _set(post, kind, !enabled, restore: prior, restoreFollow: priorFollow);
      _versions[key] = ++_epoch;
      state = state.copy(
        busy: {...state.busy}..remove(key),
        unknown: feedUncertain(error) ? {...state.unknown, key} : state.unknown,
      );
      try {
        final readEpoch = epoch;
        final fresh = await repository.detail(
          FeedDetailScope(post.id),
          cancel,
          signedIn: true,
        );
        if (mounted) ingest(fresh, readEpoch);
      } catch (readError) {
        if (feedErrorStatus(readError) == 404) unavailable(post.id);
      }
      return feedError(error);
    } finally {
      if (mounted) state = state.copy(busy: {...state.busy}..remove(key));
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}
