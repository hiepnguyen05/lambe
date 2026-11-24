import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_local_cache.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';

import 'feed_fixture.dart';

void main() {
  late Directory folder;
  final at = DateTime.utc(2026, 11, 20);
  setUp(() async {
    folder = await Directory.systemTemp.createTemp('lambe_feed_cache_test_');
  });
  tearDown(() async {
    // Only the one file owned by this test cache is removed; no recursive deletion.
    final file = File(
      '${folder.path}${Platform.pathSeparator}lambe_feed_v1.json',
    );
    if (await file.exists()) await file.delete();
    await folder.delete();
  });

  test('persists public posts across cold starts without viewer flags or managed metadata', () async {
    final cache = FeedLocalCache(
      account: 'a',
      directory: () async => folder,
      now: () => at,
    );
    final post = feedPostFromJson({
      ...postJson(),
      'viewer': {'liked': true, 'saved': true, 'followed': true},
    });
    await cache.write(const FeedScope(), [post]);
    final cold = FeedLocalCache(
      account: 'a',
      directory: () async => folder,
      now: () => at,
    );
    final rows = await cold.read(const FeedScope());
    expect(rows.single.id, post.id);
    expect(rows.single.liked, isFalse);
    expect(rows.single.saved, isFalse);
    expect(rows.single.managed, isFalse);
  });

  test(
    'account switch clears cache and never serves previous account content',
    () async {
      final cache = FeedLocalCache(
        account: 'a',
        directory: () async => folder,
        now: () => at,
      );
      await cache.write(const FeedScope(), [feedPostFromJson(postJson())]);
      cache.switchAccount('b');
      expect(await cache.read(const FeedScope()), isEmpty);
      expect(
        await File('${folder.path}${Platform.pathSeparator}lambe_feed_v1.json')
            .exists(),
        isFalse,
      );
    },
  );

  test('expires after 15 minutes and refuses managed/saved lists', () async {
    final cache = FeedLocalCache(directory: () async => folder, now: () => at);
    await cache.write(const FeedScope(), [feedPostFromJson(postJson())]);
    final expired = FeedLocalCache(
      directory: () async => folder,
      now: () => at.add(const Duration(minutes: 16)),
    );
    expect(await expired.read(const FeedScope()), isEmpty);
    expect(await cache.read(const FeedScope(mode: FeedMode.saved)), isEmpty);
    await cache.write(const FeedScope(mode: FeedMode.mine), [
      feedPostFromJson(postJson(), managed: true),
    ]);
    expect(await cache.read(const FeedScope(mode: FeedMode.mine)), isEmpty);
  });

  test(
    'removes posts rejected by visibility checks from all cached pages',
    () async {
      final cache = FeedLocalCache(
        directory: () async => folder,
        now: () => at,
      );
      final post = feedPostFromJson(postJson());
      await cache.write(const FeedScope(), [post]);
      await cache.write(const FeedScope(providerId: 'provider'), [post]);
      await cache.remove(post.id);
      expect(await cache.read(const FeedScope()), isEmpty);
      expect(
        await cache.read(const FeedScope(providerId: 'provider')),
        isEmpty,
      );
    },
  );
}
