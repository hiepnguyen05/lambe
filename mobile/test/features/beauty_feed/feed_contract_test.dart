import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_repository.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_publishing_repository.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_draft.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_interactions_controller.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_publishing_controller.dart';

import 'feed_fixture.dart';
import '../provider/services/support/service_fakes.dart' show offeringJson;

class FeedAdapter implements HttpClientAdapter {
  final Future<Object> Function(RequestOptions) handle;
  FeedAdapter(this.handle);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    if (stream != null) await stream.drain<void>();
    return ResponseBody.fromString(
      jsonEncode({'success': true, 'data': await handle(options)}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

FeedDraft draft({
  String caption = 'Tóc đẹp',
  String? memberId,
  List<String> ids = const ['offering-1'],
  bool customer = false,
  bool consent = false,
}) => FeedDraft(
  caption: caption,
  memberId: memberId,
  serviceIds: ids,
  includesCustomer: customer,
  hasConsent: consent,
);

void main() {
  test(
    'publishing context carries the worker membership and eligible services',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.httpClientAdapter = FeedAdapter((options) async {
        expect(options.path, '/me/feed/publishing-context');
        return {
          'providerId': 'provider-1',
          'memberId': 'member-1',
          'offerings': [offeringJson()],
        };
      });
      final context = await FeedPublishingRepository(dio)
          .context(CancelToken());
      expect(context.memberId, 'member-1');
      expect(context.offerings.single.id, 'offering');
    },
  );

  test(
    'post maps offering/catalog IDs separately and preserves media order',
    () {
      final json = postJson();
      json['media'] = [
        {
          'id': 'second',
          'kind': 'IMAGE',
          'url': 'https://example.test/b.png',
          'position': 1,
        },
        {
          'id': 'first',
          'kind': 'VIDEO',
          'url': 'https://example.test/a.mp4',
          'position': 0,
          'durationSeconds': 30,
        },
      ];
      final value = feedPostFromJson(json);
      expect(value.services.single.id, 'offering-1');
      expect(value.services.single.serviceId, 'catalog-1');
      expect(value.media.map((v) => v.id), ['second', 'first']);
      expect(value.media.last.video, isTrue);
    },
  );
  for (final url in [
    'http://example.test/a.png',
    'javascript:alert(1)',
    'https://name:pass@example.test/a.png',
    '/relative.png',
  ]) {
    test('rejects unsafe media URL $url', () {
      final json = postJson();
      (json['media'] as List).first['url'] = url;
      expect(() => feedPostFromJson(json), throwsFormatException);
    });
  }
  test('invalid counts and unsupported media fail explicitly', () {
    final json = postJson();
    json['counts']['likes'] = -1;
    expect(() => feedPostFromJson(json), throwsFormatException);
    json['counts']['likes'] = 0;
    json['media'][0]['kind'] = 'SVG';
    expect(() => feedPostFromJson(json), throwsFormatException);
  });
  test('soft-deleted comment remains a tombstone with children', () {
    final value = feedCommentFromJson({
      ...commentJson(deleted: true),
      'replyCount': 1,
      'replies': [commentJson(id: 'reply', parent: 'comment-1')],
    });
    expect(value.deleted, isTrue);
    expect(value.text, isNull);
    expect(value.replies.single.parentId, value.id);
  });
  test('create-comment ACK without pagination fields is supported', () {
    final value = feedCommentFromJson(commentJson());
    expect(value.replies, isEmpty);
    expect(value.replyCount, 0);
    expect(value.user.name, 'Khách');
  });
  test('hidden and pending managed posts are never labelled public', () {
    expect(post(status: 'HIDDEN').published, isFalse);
    expect(post(review: 'PENDING').published, isFalse);
    expect(post(review: 'REJECTED').moderationLabel, 'Tổ chức đã từ chối');
  });
  test(
    'draft validates trimmed caption, unique offerings and customer consent',
    () {
      expect(draft(caption: ' ').validate(), isNotNull);
      expect(draft(caption: 'x' * 2001).validate(), isNotNull);
      expect(draft(ids: []).validate(), isNotNull);
      expect(draft(ids: ['a', 'a']).validate(), isNotNull);
      expect(draft(ids: ['a', 'b', 'c', 'd', 'e', 'f']).validate(), isNotNull);
      expect(draft(customer: true).validate(), isNotNull);
      expect(
        draft(
          caption: '  Nội dung  ',
          customer: true,
          consent: true,
        ).validate(),
        isNull,
      );
    },
  );
  for (final mode in FeedMode.values) {
    test(
      'signed-in ${mode.name} uses correct endpoint and nested cursor envelope',
      () async {
        final dio = Dio();
        addTearDown(dio.close);
        dio.httpClientAdapter = FeedAdapter((o) async {
          expect(
            o.path,
            mode == FeedMode.all ? '/me/feed/posts' : '/me/feed/${mode.name}',
          );
          expect(o.queryParameters, {
            'limit': 20,
            'cursor': 'anchor',
            'providerId': 'provider-1',
            'serviceId': 'catalog-1',
          });
          return {
            'data': [postJson(liked: true)],
            'nextCursor': 'post-1',
          };
        });
        final page = await FeedRepository(dio).list(
          FeedScope(
            mode: mode,
            providerId: 'provider-1',
            serviceId: 'catalog-1',
          ),
          CancelToken(),
          signedIn: true,
          cursor: 'anchor',
        );
        expect(page.items.single.liked, isTrue);
        expect(page.cursor, 'post-1');
        expect(page.items.single.managed, mode == FeedMode.mine);
      },
    );
  }
  test(
    'guest all reads public endpoint; authenticated detail rejects ID mismatch',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.httpClientAdapter = FeedAdapter((o) async {
        expect(o.path, '/feed/posts');
        return {'data': [], 'nextCursor': null};
      });
      final repo = FeedRepository(dio);
      expect(
        (await repo.list(
          const FeedScope(),
          CancelToken(),
          signedIn: false,
        )).items,
        isEmpty,
      );
      dio.httpClientAdapter = FeedAdapter((o) async {
        expect(o.path, '/me/feed/posts/expected');
        return postJson(id: 'wrong');
      });
      await expectLater(
        repo.detail(
          const FeedDetailScope('expected'),
          CancelToken(),
          signedIn: true,
        ),
        throwsFormatException,
      );
    },
  );
  for (final kind in ['like', 'save', 'follow']) {
    test('$kind uses idempotent PUT/DELETE and authoritative ACK', () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.httpClientAdapter = FeedAdapter((o) async {
        expect(
          o.path,
          kind == 'follow'
              ? '/me/feed/providers/id/follow'
              : '/me/feed/posts/id/$kind',
        );
        return {kind == 'follow' ? 'following' : '${kind}d': o.method == 'PUT'};
      });
      final repo = FeedRepository(dio);
      expect(await repo.react('id', kind, true, CancelToken()), isTrue);
      expect(await repo.react('id', kind, false, CancelToken()), isFalse);
    });
  }
  test(
    'multipart sends repeated files, JSON service IDs and privacy booleans',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.httpClientAdapter = FeedAdapter((o) async {
        final form = o.data as FormData;
        expect(Map.fromEntries(form.fields), {
          'caption': 'Tóc đẹp',
          'memberId': 'member-1',
          'providerServiceIds': '["offering-1"]',
          'includesCustomer': 'true',
          'hasCustomerConsent': 'true',
        });
        expect(form.files.single.key, 'files');
        expect(form.files.single.value.filename, 'feed_0.jpg');
        expect(o.headers['idempotency-key'], 'feed_request_123');
        return postJson();
      });
      final file = XFile.fromData(
        Uint8List.fromList([255, 216, 255, 0, 1, 2]),
        name: 'private-original.jpg',
      );
      final value = await FeedPublishingRepository(dio).create(
        draft(memberId: 'member-1', customer: true, consent: true),
        [file],
        CancelToken(),
        (_, _) {},
        'feed_request_123',
      );
      expect(value.managed, isTrue);
    },
  );
  test('rejects empty, mixed media, fake image and over-count selection before POST', () async {
    final dio = Dio();
    addTearDown(dio.close);
    var sent = 0;
    dio.httpClientAdapter = FeedAdapter((_) async {
      sent++;
      return postJson();
    });
    final upload = FeedPublishingRepository(dio), token = CancelToken();
    final png = XFile.fromData(
      Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10]),
      name: 'a.png',
    );
    final mp4 = XFile.fromData(
      Uint8List.fromList([0, 0, 0, 12, ...'ftypmp42'.codeUnits]),
      name: 'a.mp4',
    );
    for (final files in <List<XFile>>[
      [],
      [png, mp4],
      List.filled(7, png),
      [
        XFile.fromData(
          Uint8List.fromList('not-an-image'.codeUnits),
          name: 'fake.jpg',
        ),
      ],
    ]) {
      await expectLater(
        upload.create(draft(), files, token, (_, _) {}, 'feed_request_123'),
        throwsA(isA<Exception>()),
      );
    }
    expect(sent, 0);
  });
  test(
    'MP4 streams as one file, media duration is left to backend verification',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.httpClientAdapter = FeedAdapter((o) async {
        expect(o.path, '/me/feed/posts/video');
        expect((o.data as FormData).files.single.key, 'file');
        expect((o.data as FormData).files.single.value.filename, 'feed_0.mp4');
        return postJson();
      });
      final file = XFile.fromData(
        Uint8List.fromList([0, 0, 0, 12, ...'ftypmp42'.codeUnits]),
        name: 'a.mp4',
        path: 'a.mp4',
      );
      await FeedPublishingRepository(
        dio,
      ).create(draft(), [file], CancelToken(), (_, _) {}, 'feed_request_123');
    },
  );
  test('edit preflight blocks stale revision before PATCH', () async {
    final repo = FakeFeedRepository()
      ..onDetail = (_) async =>
          feedPostFromJson({...postJson(), 'revisionNumber': 3}, managed: true);
    final signals = FeedInteractionsController(repo);
    addTearDown(signals.dispose);
    final publisher = FeedPublishingController(
      repo,
      FeedPublishingRepository(Dio()),
      signals,
      changed: () {},
    );
    addTearDown(publisher.dispose);
    expect(
      await publisher.save(draft(), [], editing: post(managed: true)),
      isNull,
    );
    expect(repo.updateCalls, 0);
    expect(publisher.state.uncertain, isFalse);
  });
  test(
    'unknown PATCH blocks automatic retry; explicit new intent required',
    () async {
      final repo = FakeFeedRepository()
        ..onUpdate = (_) => Future.error(failure());
      final signals = FeedInteractionsController(repo);
      addTearDown(signals.dispose);
      final publisher = FeedPublishingController(
        repo,
        FeedPublishingRepository(Dio()),
        signals,
        changed: () {},
      );
      addTearDown(publisher.dispose);
      await publisher.save(draft(), [], editing: post(managed: true));
      expect(publisher.state.uncertain, isTrue);
      await publisher.save(draft(), [], editing: post(managed: true));
      expect(repo.updateCalls, 1);
      publisher.beginNewIntent();
      expect(publisher.state.uncertain, isFalse);
    },
  );
  test('delete marks all cached views unavailable only after ACK', () async {
    final repo = FakeFeedRepository(),
        signals = FeedInteractionsController(FakeFeedRepository());
    addTearDown(signals.dispose);
    var changed = 0;
    final publisher = FeedPublishingController(
      repo,
      FeedPublishingRepository(Dio()),
      signals,
      changed: () => changed++,
    );
    addTearDown(publisher.dispose);
    expect(await publisher.remove('post-1'), isTrue);
    expect(signals.state.deleted, contains('post-1'));
    expect(changed, 1);
  });
}
