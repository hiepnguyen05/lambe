import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_interactions_controller.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_list_controller.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_detail_controller.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_comments_controller.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_post.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_comment.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';

import 'feed_fixture.dart';

void main() {
  late FakeFeedRepository repo;
  late FeedInteractionsController signals;
  setUp(() {
    repo = FakeFeedRepository();
    signals = FeedInteractionsController(repo);
  });
  tearDown(() {
    signals.dispose();
  });
  test(
    'like is immediate; duplicate taps do not produce duplicate requests',
    () async {
      final done = Completer<bool>();
      repo.onReact = (_, _, _) => done.future;
      final pending = signals.toggle(post(), 'like');
      expect(signals.state.posts['post-1']!.likes, 4);
      expect(signals.state.posts['post-1']!.liked, isTrue);
      await signals.toggle(post(), 'like');
      expect(repo.reactCalls, 1);
      done.complete(true);
      expect(await pending, isNull);
      expect(signals.state.busy, isEmpty);
    },
  );
  test('slow old GET cannot undo a completed optimistic write', () async {
    final old = signals.epoch;
    await signals.toggle(post(), 'like');
    signals.ingest(post(), old);
    expect(signals.state.posts['post-1']!.liked, isTrue);
    signals.ingest(post(liked: true), signals.epoch);
    expect(signals.state.posts['post-1']!.liked, isTrue);
  });
  test(
    'failure of like rolls back only like while concurrent save succeeds',
    () async {
      final like = Completer<bool>(), save = Completer<bool>();
      repo.onReact = (_, kind, _) => kind == 'like' ? like.future : save.future;
      repo.onDetail = (_) => Future.error(failure());
      final a = signals.toggle(post(), 'like'),
          b = signals.toggle(post(), 'save');
      save.complete(true);
      await b;
      like.completeError(failure(400));
      await a;
      expect(signals.state.posts['post-1']!.liked, isFalse);
      expect(signals.state.posts['post-1']!.saved, isTrue);
      expect(signals.state.posts['post-1']!.saves, 3);
    },
  );
  test('timeout blocks repeat until authoritative reconciliation', () async {
    repo.onReact = (_, _, _) => Future.error(failure());
    repo.onDetail = (_) => Future.error(failure());
    await signals.toggle(post(), 'like');
    expect(signals.state.unknown, contains('like:post-1'));
    await signals.toggle(post(), 'like');
    expect(repo.reactCalls, 1);
    signals.ingest(post(liked: true), signals.epoch);
    expect(signals.state.unknown, isEmpty);
  });
  test('follow is shared by provider across different posts', () async {
    await signals.toggle(post(), 'follow');
    signals.ingest(post(id: 'post-2'), 0);
    expect(signals.state.follows['provider-1'], isTrue);
  });
  test('managed reads cannot overwrite public reactions or restore hidden visibility', () {
    signals.unavailable('post-1');
    signals.ingest(post(managed: true), signals.epoch);
    signals.markChanged(post(managed: true));
    expect(signals.state.posts, isEmpty);
    expect(signals.state.unavailable, contains('post-1'));
  });
  test('public fresh read can restore visibility; pre-hide reads cannot', () {
    signals.unavailable('post-1');
    signals.ingest(post(), 0);
    expect(signals.state.unavailable, contains('post-1'));
    signals.ingest(post(), signals.epoch);
    expect(signals.state.unavailable, isEmpty);
  });
  test('404 during reconciliation removes public post', () async {
    repo.onReact = (_, _, _) => Future.error(failure(404));
    repo.onDetail = (_) => Future.error(failure(404));
    await signals.toggle(post(), 'save');
    expect(signals.state.unavailable, contains('post-1'));
  });
  test(
    'list preserves server order, deduplicates overlap and stops at end',
    () async {
      repo.onList = (_, cursor) async => cursor == null
          ? FeedPage([post(id: 'z'), post(id: 'a')], 'a')
          : FeedPage([post(id: 'a'), post(id: 'm')], null);
      final list = FeedListController(repo, signals, const FeedScope(), true);
      addTearDown(list.dispose);
      await list.load();
      await list.load();
      await list.load();
      expect(list.state.items.map((v) => v.id), ['z', 'a', 'm']);
      expect(repo.listCalls, 2);
    },
  );
  test(
    'refresh keeps current rows visible and discards old pagination response',
    () async {
      final page = Completer<FeedPage<FeedPost>>();
      repo.onList = (_, cursor) async =>
          cursor == null ? FeedPage([post()], 'next') : page.future;
      final list = FeedListController(repo, signals, const FeedScope(), true);
      addTearDown(list.dispose);
      await list.load();
      final pending = list.load();
      repo.onList = (_, _) async => FeedPage([post(id: 'new')], null);
      await list.load(refresh: true);
      page.complete(FeedPage([post(id: 'stale')], null));
      await pending;
      expect(list.state.items.single.id, 'new');
    },
  );
  test('cursor invalidation requires refresh; does not repeatedly replay bad cursor', () async {
    repo.onList = (_, cursor) async {
      if (cursor != null) throw failure(400);
      return FeedPage([post()], 'next');
    };
    final list = FeedListController(repo, signals, const FeedScope(), true);
    addTearDown(list.dispose);
    await list.load();
    await list.load();
    await list.load();
    expect(list.state.invalidCursor, isTrue);
    expect(repo.listCalls, 2);
    await list.load(refresh: true);
    expect(repo.listCalls, 3);
  });
  test('private feed scopes do not request data when signed out', () async {
    for (final mode in [FeedMode.mine, FeedMode.saved, FeedMode.following]) {
      final list = FeedListController(
        repo,
        signals,
        FeedScope(mode: mode),
        false,
      );
      await list.load();
      expect(list.state.error, isNotNull);
      list.dispose();
    }
    expect(repo.listCalls, 0);
  });
  test('scopes are keyed by mode and filters', () {
    expect(const FeedScope(), isNot(const FeedScope(mode: FeedMode.saved)));
    expect(
      const FeedScope(providerId: 'a'),
      isNot(const FeedScope(providerId: 'b')),
    );
    expect(
      const FeedDetailScope('a'),
      isNot(const FeedDetailScope('a', manage: true)),
    );
  });
  test(
    'detail retains data on network failure but clears on revoked visibility',
    () async {
      final detail = FeedDetailController(
        repo,
        signals,
        const FeedDetailScope('post-1'),
        true,
      );
      addTearDown(detail.dispose);
      await detail.load();
      repo.onDetail = (_) => Future.error(failure());
      await detail.load();
      expect(detail.state.post, isNotNull);
      expect(detail.state.error, isNotNull);
      repo.onDetail = (_) => Future.error(failure(404));
      await detail.load();
      expect(detail.state.post, isNull);
      expect(signals.state.unavailable, contains('post-1'));
    },
  );
  test('dispose cancels requests without publishing late results', () async {
    final pending = Completer<FeedPost>();
    repo.onDetail = (_) => pending.future;
    final detail = FeedDetailController(
      repo,
      signals,
      const FeedDetailScope('post-1'),
      true,
    );
    final read = detail.load();
    detail.dispose();
    expect(detail.cancel.isCancelled, isTrue);
    pending.complete(post());
    await read;
    expect(signals.state.posts, isEmpty);
  });
  test(
    'comment sends root parent ID, single flight and resets only after ACK',
    () async {
      final done = Completer<FeedComment>();
      repo.onComment = (text, parent) {
        expect(text, 'Đẹp');
        expect(parent, 'root');
        return done.future;
      };
      final comments = FeedCommentsController(repo, 'post-1');
      addTearDown(comments.dispose);
      final first = comments.send('Đẹp', parentId: 'root');
      expect(await comments.send('Đẹp'), isFalse);
      done.complete(feedCommentFromJson(commentJson(parent: 'root')));
      expect(await first, isTrue);
      expect(repo.commentCalls, 1);
    },
  );
  test(
    'comment timeout does not auto resubmit; manual refresh unlocks composer',
    () async {
      repo.onComment = (_, _) => Future.error(failure());
      final comments = FeedCommentsController(repo, 'post-1');
      addTearDown(comments.dispose);
      expect(await comments.send('Đẹp'), isFalse);
      expect(comments.state.uncertain, isTrue);
      await comments.send('Đẹp');
      expect(repo.commentCalls, 1);
      await comments.load(refresh: true);
      expect(comments.state.uncertain, isFalse);
    },
  );
  test('blank or overlong comments are rejected without networking', () async {
    final comments = FeedCommentsController(repo, 'post-1');
    addTearDown(comments.dispose);
    expect(await comments.send('  '), isFalse);
    expect(await comments.send('x' * 1001), isFalse);
    expect(repo.commentCalls, 0);
  });
}
