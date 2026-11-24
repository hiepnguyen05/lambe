import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/upload_payload.dart';
import 'package:mobile/features/shared/chat/application/chat_attachment_service.dart';
import 'package:mobile/features/shared/chat/application/chat_room_notifier.dart';
import 'package:mobile/features/shared/chat/data/datasources/chat_events_source.dart';
import 'package:mobile/features/shared/chat/data/datasources/chat_remote_datasource.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_message_entity.dart';

typedef _Page = ({List<ChatMessageEntity> messages, int? nextCursor});

const _images = [
  UploadPayload(bytes: [1, 2, 3], fileName: 'photo.jpg'),
];

class _Request {
  final String clientMessageId;
  final ChatMessageKind kind;
  final String? text;
  final String? providerServiceId;
  final List<UploadPayload> images;
  final result = Completer<ChatMessageEntity>();

  _Request(
    this.clientMessageId,
    this.kind, {
    this.text,
    this.providerServiceId,
    this.images = const [],
  });

  ChatMessageEntity saved({bool includeClientId = true}) => ChatMessageEntity(
    id: 'saved:$clientMessageId',
    sequence: 51,
    kind: kind,
    text: text,
    providerServiceId: providerServiceId,
    clientMessageId: includeClientId ? clientMessageId : null,
    createdAt: DateTime(2026, 10, 30),
  );
}

class _DataSource extends Fake implements ChatRemoteDataSource {
  final requests = <_Request>[];
  final beforeSequences = <int?>[];
  final afterSequences = <int?>[];
  _Page initial = (messages: [], nextCursor: 20);
  _Page newer = (messages: [], nextCursor: null);
  Completer<_Page>? initialResult;
  Completer<_Page>? olderResult;

  @override
  Future<_Page> getMessages({
    required String conversationId,
    int? beforeSequence,
    int? afterSequence,
    int limit = 50,
  }) async {
    beforeSequences.add(beforeSequence);
    afterSequences.add(afterSequence);
    if (beforeSequence != null) return olderResult!.future;
    if (afterSequence != null) return newer;
    return initialResult?.future ?? Future.value(initial);
  }

  @override
  Future<ChatMessageEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String kind,
    String? text,
    String? providerServiceId,
  }) {
    final request = _Request(
      clientMessageId,
      kind == 'TEXT' ? ChatMessageKind.text : ChatMessageKind.serviceCard,
      text: text,
      providerServiceId: providerServiceId,
    );
    requests.add(request);
    return request.result.future;
  }

  @override
  Future<ChatMessageEntity> sendImages({
    required String conversationId,
    required String clientMessageId,
    required List<UploadPayload> images,
  }) {
    final request = _Request(
      clientMessageId,
      ChatMessageKind.image,
      images: images,
    );
    requests.add(request);
    return request.result.future;
  }

  @override
  Future<int> markRead({
    required String conversationId,
    required int lastReadSequence,
  }) async => lastReadSequence;

  @override
  Future<bool> blockConversation({required String conversationId}) async =>
      true;
}

class _Events implements ChatEventsSource {
  final controller = StreamController<ChatMessageEntity>();

  @override
  Stream<ChatMessageEntity> watch({
    required String conversationId,
    required int afterSequence,
    required CancelToken cancelToken,
    required void Function() onConnected,
  }) {
    onConnected();
    cancelToken.whenCancel.then((_) => controller.close());
    return controller.stream;
  }
}

Future<void> _flush() => Future<void>.delayed(Duration.zero);

Future<({ChatRoomNotifier room, _DataSource data, _Events events})>
_open() async {
  final data = _DataSource();
  final events = _Events();
  final room = ChatRoomNotifier(
    data,
    conversationId: 'room',
    eventsSource: events,
  );
  addTearDown(() async {
    if (room.mounted) room.dispose();
    await events.controller.close();
  });
  await _flush();
  return (room: room, data: data, events: events);
}

Future<bool> _send(ChatRoomNotifier room, ChatMessageKind kind) =>
    switch (kind) {
      ChatMessageKind.text => room.sendTextMessage(' hello '),
      ChatMessageKind.image => room.sendImages(_images),
      ChatMessageKind.serviceCard => room.sendServiceCard('service-1'),
      ChatMessageKind.orderEvent => throw StateError('Not user-sendable'),
    };

void main() {
  for (final kind in [
    ChatMessageKind.text,
    ChatMessageKind.image,
    ChatMessageKind.serviceCard,
  ]) {
    group(kind.name, () {
      test('optimistic failure retries the original payload and id only once', () async {
        final h = await _open();
        final sending = _send(h.room, kind);
        final pending = h.room.state.messages.single;
        expect(pending.kind, kind);
        expect(pending.isSending, isTrue);
        expect(pending.hasError, isFalse);
        expect(h.room.state.highestSequence, 0);
        expect(h.room.state.olderSequenceCursor, 20);
        final first = h.data.requests.single;
        first.result.completeError(Exception('Offline'));
        expect(await sending, isFalse);
        final failed = h.room.state.messages.single;
        expect(failed.hasError, isTrue);
        expect(failed.isSending, isFalse);
        expect(h.room.canRetryMessage(failed), isTrue);

        // Stale UI objects cannot replace the payload retained by the notifier.
        final retrying = h.room.retryMessage(
          failed.copyWith(
            text: 'wrong text',
            providerServiceId: 'wrong-service',
          ),
        );
        expect(h.room.state.messages.single.hasError, isFalse);
        expect(h.room.state.messages.single.createdAt, pending.createdAt);
        expect(await h.room.retryMessage(failed), isFalse);
        expect(await h.room.sendImages(_images), isFalse);
        expect(await h.room.sendServiceCard('other-service'), isFalse);
        expect(await h.room.sendTextMessage('other text'), isFalse);
        expect(h.data.requests, hasLength(2));
        final retry = h.data.requests.last;
        expect(retry.clientMessageId, first.clientMessageId);
        expect(retry.text, first.text);
        expect(retry.providerServiceId, first.providerServiceId);
        expect(retry.images, first.images);
        retry.result.complete(retry.saved(includeClientId: false));
        expect(await retrying, isTrue);
        final saved = h.room.state.messages.single;
        expect(saved.id, retry.saved().id);
        expect(saved.clientMessageId, first.clientMessageId);
        expect(saved.isSending, isFalse);
        expect(saved.hasError, isFalse);
        expect(h.room.retainedImageBytes, 0);
        expect(h.room.pendingImagesFor(failed), isEmpty);
        expect(await h.room.retryMessage(failed), isFalse);
        expect(h.data.requests, hasLength(2));
        expect(h.room.state.olderSequenceCursor, 20);
      });

      for (final httpFails in [false, true]) {
        test(
          'SSE before HTTP ${httpFails ? 'error' : 'success'} confirms once and frees images',
          () async {
            final h = await _open();
            final sending = _send(h.room, kind);
            final pending = h.room.state.messages.single;
            final request = h.data.requests.single;
            expect(await _send(h.room, kind), isFalse);
            expect(await h.room.retryMessage(pending), isFalse);
            h.events.controller.add(request.saved());
            await _flush();
            expect(h.room.state.messages.single.id, request.saved().id);
            expect(h.room.retainedImageBytes, 0);
            expect(h.room.state.isSending, isTrue);
            // Keep the send guard until the HTTP request has settled.
            expect(await _send(h.room, kind), isFalse);
            h.events.controller.add(request.saved(includeClientId: false));
            await _flush();
            if (httpFails) {
              request.result.completeError(Exception('HTTP response lost'));
            } else {
              request.result.complete(request.saved(includeClientId: false));
            }
            expect(await sending, isTrue);
            expect(h.room.state.isSending, isFalse);
            expect(h.room.state.errorMessage, isNull);
            expect(h.room.state.messages.single.hasError, isFalse);
            expect(
              h.room.state.messages.single.clientMessageId,
              request.clientMessageId,
            );
            expect(h.room.state.olderSequenceCursor, 20);
            expect(h.data.requests, hasLength(1));
          },
        );
      }

      test(
        'HTTP success then repeated SSE stays delivered exactly once',
        () async {
          final h = await _open();
          final sending = _send(h.room, kind);
          final request = h.data.requests.single;
          request.result.complete(request.saved(includeClientId: false));
          expect(await sending, isTrue);
          h.events.controller.add(request.saved());
          h.events.controller.add(request.saved());
          await _flush();
          expect(h.room.state.messages, hasLength(1));
          expect(h.room.state.messages.single.id, request.saved().id);
          expect(h.room.retainedImageBytes, 0);
        },
      );

      test(
        'late SSE removes failure and stale retry cannot send again',
        () async {
          final h = await _open();
          final sending = _send(h.room, kind);
          final request = h.data.requests.single;
          request.result.completeError(Exception('Timed out'));
          expect(await sending, isFalse);
          final failed = h.room.state.messages.single;
          h.events.controller.add(request.saved());
          await _flush();
          expect(h.room.state.messages.single.id, request.saved().id);
          expect(h.room.canRetryMessage(failed), isFalse);
          expect(await h.room.retryMessage(failed), isFalse);
          expect(h.room.retainedImageBytes, 0);
          expect(h.data.requests, hasLength(1));
        },
      );

      test('SSE during retry followed by HTTP error succeeds once', () async {
        final h = await _open();
        final first = _send(h.room, kind);
        h.data.requests.single.result.completeError(Exception('Offline'));
        expect(await first, isFalse);
        final retrying = h.room.retryMessage(h.room.state.messages.single);
        final retry = h.data.requests.last;
        h.events.controller.add(retry.saved());
        await _flush();
        retry.result.completeError(Exception('Response lost'));
        expect(await retrying, isTrue);
        expect(h.room.state.messages.single.id, retry.saved().id);
        expect(h.room.state.errorMessage, isNull);
        expect(h.room.retainedImageBytes, 0);
      });
    });
  }

  test('image payload is an immutable snapshot until retry succeeds', () async {
    final h = await _open();
    final bytes = [1, 2, 3];
    final selection = [UploadPayload(bytes: bytes, fileName: 'original.jpg')];
    final sending = h.room.sendImages(selection);
    final pending = h.room.state.messages.single;
    bytes[0] = 99;
    selection.clear();
    h.data.requests.single.result.completeError(Exception('Offline'));
    expect(await sending, isFalse);
    final retained = h.room.pendingImagesFor(pending);
    expect(retained.single.bytes, [1, 2, 3]);
    expect(retained.single.fileName, 'original.jpg');
    expect(() => retained.clear(), throwsUnsupportedError);
    expect(() => retained.single.bytes[0] = 9, throwsUnsupportedError);
    final retrying = h.room.retryMessage(h.room.state.messages.single);
    final retry = h.data.requests.last;
    expect(retry.images.single.bytes, [1, 2, 3]);
    retry.result.complete(retry.saved());
    expect(await retrying, isTrue);
    expect(h.room.retainedImageBytes, 0);
  });

  test('image failure retention evicts the oldest batch by count', () async {
    final h = await _open();
    for (var i = 0; i <= ChatRoomNotifier.maxRetainedImageMessages; i++) {
      final sending = h.room.sendImages(_images);
      h.data.requests.last.result.completeError(Exception('Offline'));
      expect(await sending, isFalse);
    }
    final failures = h.room.state.messages;
    expect(failures, hasLength(4));
    final oldest = failures.firstWhere(
      (m) => m.clientMessageId == h.data.requests.first.clientMessageId,
    );
    expect(h.room.pendingImagesFor(oldest), isEmpty);
    expect(await h.room.retryMessage(oldest), isFalse);
    expect(h.room.retainedImageBytes, 9);
    expect(failures.where(h.room.canRetryMessage), hasLength(3));
  });

  test(
    'image retention also evicts by bytes, accepting four 5 MiB files',
    () async {
      final h = await _open();
      final small = h.room.sendImages(_images);
      h.data.requests.last.result.completeError(Exception('Offline'));
      expect(await small, isFalse);
      final oldest = h.room.state.messages.single;
      final large = List.generate(
        4,
        (i) => UploadPayload(
          bytes: Uint8List(ChatAttachmentService.maxFileSizeInBytes),
          fileName: '$i.jpg',
        ),
      );
      final sending = h.room.sendImages(large);
      expect(h.room.retainedImageBytes, ChatRoomNotifier.maxRetainedImageBytes);
      expect(h.room.pendingImagesFor(oldest), isEmpty);
      h.data.requests.last.result.completeError(Exception('Offline'));
      expect(await sending, isFalse);
      expect(h.room.canRetryMessage(oldest), isFalse);
    },
  );

  test('invalid image sends do not evict an existing failure', () async {
    final h = await _open();
    final sending = h.room.sendImages(_images);
    h.data.requests.single.result.completeError(Exception('Offline'));
    expect(await sending, isFalse);
    final failed = h.room.state.messages.single;
    for (final images in <List<UploadPayload>>[
      [],
      List.filled(5, _images.single),
      [const UploadPayload(bytes: [], fileName: 'empty.jpg')],
      [
        UploadPayload(
          bytes: Uint8List(ChatAttachmentService.maxFileSizeInBytes + 1),
          fileName: 'big.jpg',
        ),
      ],
    ]) {
      expect(await h.room.sendImages(images), isFalse);
    }
    expect(h.room.state.messages, [failed]);
    expect(h.room.canRetryMessage(failed), isTrue);
    expect(h.room.retainedImageBytes, 3);
    expect(h.data.requests, hasLength(1));
  });

  for (final httpFails in [false, true]) {
    test(
      'dispose clears failed and active images before late HTTP ${httpFails ? 'error' : 'success'}',
      () async {
        final h = await _open();
        final first = h.room.sendImages(_images);
        h.data.requests.single.result.completeError(Exception('Offline'));
        expect(await first, isFalse);
        final failed = h.room.state.messages.single;
        final sending = h.room.sendImages(_images);
        final pending = h.room.state.messages.last;
        var updates = 0;
        h.room.addListener((_) => updates++, fireImmediately: false);
        h.room.dispose();
        expect(h.room.retainedImageBytes, 0);
        expect(h.room.pendingImagesFor(failed), isEmpty);
        expect(h.room.pendingImagesFor(pending), isEmpty);
        final request = h.data.requests.last;
        if (httpFails) {
          request.result.completeError(Exception('Response lost'));
        } else {
          request.result.complete(request.saved());
        }
        expect(await sending, isFalse);
        expect(updates, 0);
        expect(await h.room.sendImages(_images), isFalse);
        expect(await h.room.retryMessage(failed), isFalse);
      },
    );
  }

  test('copyWith preserves cursor and supports explicitly clearing it', () {
    const state = ChatRoomState(olderSequenceCursor: 20);
    expect(state.copyWith(isSending: true).olderSequenceCursor, 20);
    expect(state.copyWith(olderSequenceCursor: 10).olderSequenceCursor, 10);
    expect(
      state.copyWith(olderSequenceCursor: null).olderSequenceCursor,
      isNull,
    );
  });

  test(
    'pagination survives sends, SSE, read/block updates and a failed page',
    () async {
      final h = await _open();
      final sending = h.room.sendServiceCard('service-1');
      final request = h.data.requests.single;
      request.result.complete(request.saved());
      expect(await sending, isTrue);
      h.room.markVisibleMessagesRead();
      await _flush();
      expect(h.room.state.lastReadSequence, 51);
      expect(await h.room.toggleBlock(), isTrue);
      expect(h.room.state.olderSequenceCursor, 20);

      h.data.olderResult = Completer<_Page>();
      final firstPage = h.room.loadOlderMessages();
      expect(h.room.state.olderSequenceCursor, 20);
      await h.room.loadOlderMessages();
      expect(h.data.beforeSequences.whereType<int>(), [20]);
      h.data.olderResult!.completeError(Exception('Offline'));
      await firstPage;
      expect(h.room.state.isLoadingOlder, isFalse);
      expect(h.room.state.olderSequenceCursor, 20);

      h.data.olderResult = Completer<_Page>();
      final retryPage = h.room.loadOlderMessages();
      h.events.controller.add(request.saved());
      await _flush();
      h.data.olderResult!.complete((
        messages: [
          ChatMessageEntity(
            id: 'older',
            sequence: 19,
            kind: ChatMessageKind.text,
            createdAt: DateTime(2026),
          ),
          request.saved(),
        ],
        nextCursor: 10,
      ));
      await retryPage;
      expect(h.room.state.messages.map((m) => m.sequence), [19, 51]);
      expect(h.room.state.olderSequenceCursor, 10);
      h.data.newer = (messages: [request.saved()], nextCursor: null);
      await h.room.syncNewerMessages();
      expect(h.data.afterSequences.last, 51);
      expect(h.room.state.olderSequenceCursor, 10);

      h.data.olderResult = Completer<_Page>();
      final lastPage = h.room.loadOlderMessages();
      h.data.olderResult!.complete((
        messages: <ChatMessageEntity>[],
        nextCursor: null,
      ));
      await lastPage;
      expect(h.room.state.olderSequenceCursor, isNull);
      await h.room.loadOlderMessages();
      expect(h.data.beforeSequences.whereType<int>(), [20, 20, 10]);
    },
  );

  test(
    'sends while initial page loads cannot lose an optimistic message',
    () async {
      final data = _DataSource()..initialResult = Completer<_Page>();
      final room = ChatRoomNotifier(data, conversationId: 'room');
      addTearDown(room.dispose);
      // The screen may auto-send initialText before the first page arrives.
      final sending = room.sendTextMessage('Initial text');
      final pending = room.state.messages.single;
      expect(pending.isSending, isTrue);
      expect(await room.sendImages(_images), isFalse);
      expect(await room.sendServiceCard('service-1'), isFalse);
      data.initialResult!.complete((
        messages: [
          ChatMessageEntity(
            id: 'history',
            sequence: 50,
            kind: ChatMessageKind.text,
            createdAt: DateTime(2026),
          ),
        ],
        nextCursor: 20,
      ));
      await _flush();
      expect(room.state.isLoading, isFalse);
      expect(room.state.messages, contains(pending));
      final request = data.requests.single;
      request.result.complete(request.saved());
      expect(await sending, isTrue);
      expect(room.state.messages.map((m) => m.id), [
        'history',
        request.saved().id,
      ]);
      expect(room.state.olderSequenceCursor, 20);
    },
  );
}
