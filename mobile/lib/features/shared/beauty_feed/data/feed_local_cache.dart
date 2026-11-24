import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../domain/feed_post.dart';
import '../domain/feed_scope.dart';
import 'feed_mapper.dart';

/// A bounded, disposable public-content cache; never persists viewer flags or managed posts.
class FeedLocalCache {
  final Future<Directory> Function() directory;
  final DateTime Function() now;
  Future<void> _pending = Future.value();
  int _generation = 0;
  String? account;
  final _pages = <String, Map<String, dynamic>>{};
  bool _loaded = false;
  FeedLocalCache({
    this.account,
    Future<Directory> Function()? directory,
    DateTime Function()? now,
  }) : directory = directory ?? getTemporaryDirectory,
       now = now ?? DateTime.now;

  String _key(FeedScope scope) =>
      jsonEncode([scope.providerId, scope.serviceId]);
  Future<File> _file() async => File(
    '${(await directory()).path}${Platform.pathSeparator}lambe_feed_v1.json',
  );

  void switchAccount(String? next) {
    if (account == next) return;
    account = next;
    _generation++;
    _loaded = false;
    _pages.clear();
    unawaited(
      _serial(() async {
        final file = await _file();
        if (await file.exists()) await file.delete();
      }),
    );
  }

  Future<void> _serial(Future<void> Function() operation) {
    final next = _pending.then((_) => operation()).catchError((Object _) {});
    _pending = next;
    return next;
  }

  Future<void> _read() async {
    if (_loaded) return;
    _loaded = true;
    final file = await _file();
    if (!await file.exists()) return;
    if (await file.length() > 512 * 1024) {
      await file.delete();
      return;
    }
    final data = feedMap(jsonDecode(await file.readAsString()));
    if (data['schema'] != 1 || data['account'] != account) return;
    for (final entry in (data['pages'] as Map).entries.take(3)) {
      final page = feedMap(entry.value);
      final at = DateTime.tryParse(page['at'] as String? ?? '');
      if (at != null &&
          !at.isAfter(now()) &&
          now().difference(at) < const Duration(minutes: 15)) {
        _pages[entry.key as String] = page;
      }
    }
  }

  Future<List<FeedPost>> read(FeedScope scope) async {
    if (scope.mode != FeedMode.all) return [];
    final generation = _generation;
    var result = <FeedPost>[];
    await _serial(() async {
      await _read();
      if (generation != _generation) return;
      final page = _pages[_key(scope)];
      if (page == null) return;
      final at = DateTime.parse(page['at'] as String);
      if (now().difference(at) >= const Duration(minutes: 15)) return;
      result = (page['data'] as List)
          .take(20)
          .map((row) => feedPostFromJson(feedMap(row)))
          .where((post) => post.published && !post.managed)
          .toList(growable: false);
    });
    return generation == _generation ? result : [];
  }

  Future<void> write(FeedScope scope, List<FeedPost> posts) async {
    if (scope.mode != FeedMode.all) return;
    final generation = _generation;
    await _serial(() async {
      if (generation != _generation) return;
      await _read();
      if (generation != _generation) return;
      _pages.remove(_key(scope));
      _pages[_key(scope)] = {
        'at': now().toUtc().toIso8601String(),
        'data': posts
            .where((post) => post.published && !post.managed)
            .take(20)
            .map(_publicJson)
            .toList(),
      };
      while (_pages.length > 3) {
        _pages.remove(_pages.keys.first);
      }
      await _save(generation);
    });
  }

  Future<void> remove(String postId) async {
    final generation = _generation;
    await _serial(() async {
      if (generation != _generation) return;
      await _read();
      for (final page in _pages.values) {
        (page['data'] as List).removeWhere(
          (row) => feedMap(row)['id'] == postId,
        );
      }
      await _save(generation);
    });
  }

  Future<void> _save(int generation) async {
    if (generation != _generation) return;
    final data = jsonEncode({'schema': 1, 'account': account, 'pages': _pages});
    if (utf8.encode(data).length > 512 * 1024) {
      _pages.clear();
      final file = await _file();
      if (await file.exists()) await file.delete();
      return;
    }
    final file = await _file();
    if (generation != _generation) return;
    await file.writeAsString(data, flush: true);
  }

  Map<String, dynamic> _publicJson(FeedPost p) => {
    'id': p.id,
    'caption': p.caption,
    'status': p.status,
    'sharePath': p.sharePath,
    'revisionNumber': p.revision,
    'provider': {
      'id': p.provider.id,
      'displayName': p.provider.name,
      'avatarUrl': p.provider.avatar,
    },
    'authorMember': p.author == null
        ? null
        : {
            'id': p.author!.id,
            'displayName': p.author!.name,
            'avatarUrl': p.author!.avatar,
          },
    'media': p.media
        .map(
          (m) => {
            'id': m.id,
            'kind': m.kind,
            'url': m.url,
            'width': m.width,
            'height': m.height,
            'durationSeconds': m.duration,
            'position': m.position,
          },
        )
        .toList(),
    'services': p.services
        .map(
          (s) => {
            'id': s.id,
            'serviceId': s.serviceId,
            'status': s.status,
            'priceAmount': s.price,
            'durationMinutes': s.duration,
            'service': {'id': s.serviceId, 'name': s.name},
          },
        )
        .toList(),
    'counts': {'likes': p.likes, 'comments': p.comments, 'saves': p.saves},
    'viewer': {'liked': false, 'saved': false, 'followed': false},
    'createdAt': p.createdAt.toUtc().toIso8601String(),
    'updatedAt': p.updatedAt.toUtc().toIso8601String(),
  };
}
