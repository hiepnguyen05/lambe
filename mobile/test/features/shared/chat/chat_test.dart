import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/upload_payload.dart';
import 'package:mobile/core/utils/uuid_utils.dart';
import 'package:mobile/features/shared/chat/application/chat_inbox_notifier.dart';
import 'package:mobile/features/shared/chat/application/chat_room_notifier.dart';
import 'package:mobile/features/shared/chat/data/datasources/chat_remote_datasource.dart';
import 'package:mobile/features/shared/chat/data/datasources/chat_events_source.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_conversation_entity.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_message_entity.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

class _MockDio extends Fake implements Dio {
  Response<dynamic>? responseToReturn;
  DioException? postError;
  String? lastPath;
  dynamic lastData;
  Map<String, dynamic>? lastQueryParams;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastQueryParams = queryParameters;
    return responseToReturn as Response<T>;
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastData = data;
    lastQueryParams = queryParameters;
    if (postError != null) throw postError!;
    return responseToReturn as Response<T>;
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastData = data;
    return responseToReturn as Response<T>;
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastData = data;
    return responseToReturn as Response<T>;
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    lastPath = path;
    return responseToReturn as Response<T>;
  }
}

class _FakeChatEventsSource implements ChatEventsSource {
  final controller = StreamController<ChatMessageEntity>.broadcast();
  int? requestedAfterSequence;

  @override
  Stream<ChatMessageEntity> watch({
    required String conversationId,
    required int afterSequence,
    required CancelToken cancelToken,
    required void Function() onConnected,
  }) async* {
    requestedAfterSequence = afterSequence;
    onConnected();
    yield* controller.stream;
  }
}

void main() {
  group('UUID Utils Tests', () {
    test('generateV4 returns valid RFC 4122 v4 UUID string', () {
      final uuid1 = UuidUtils.generateV4();
      final uuid2 = UuidUtils.generateV4();

      expect(uuid1, isNot(equals(uuid2)));
      final regex = RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      );
      expect(regex.hasMatch(uuid1), isTrue);
      expect(regex.hasMatch(uuid2), isTrue);
    });
  });

  group('Chat Entities Parsing Tests', () {
    test('ChatMessageEntity parses TEXT message correctly', () {
      final json = {
        'id': 'msg-1',
        'sequence': 1,
        'senderUserId': 'usr-customer',
        'kind': 'TEXT',
        'text': 'Chào bạn, cho mình hỏi về dịch vụ uốn tóc',
        'createdAt': '2026-10-19T10:00:00.000Z',
        'clientMessageId': 'c3b5fa5e-c286-4447-9755-6bca95a5fbc4',
      };

      final msg = ChatMessageEntity.fromJson(json);
      expect(msg.id, 'msg-1');
      expect(msg.sequence, 1);
      expect(msg.kind, ChatMessageKind.text);
      expect(msg.text, 'Chào bạn, cho mình hỏi về dịch vụ uốn tóc');
      expect(msg.isMine('usr-customer'), isTrue);
      expect(msg.isMine('usr-provider'), isFalse);
      expect(msg.isSystem, isFalse);
    });

    test('ChatMessageEntity parses SERVICE_CARD message correctly', () {
      final json = {
        'id': 'msg-2',
        'sequence': 2,
        'senderUserId': 'usr-provider',
        'kind': 'SERVICE_CARD',
        'providerServiceId': 'psrv-99',
        'payload': {
          'serviceName': 'Uốn tóc phục hồi collagen',
          'priceAmount': 350000,
          'currencyCode': 'VND',
          'durationMinutes': 90,
        },
        'createdAt': '2026-10-19T10:05:00.000Z',
      };

      final msg = ChatMessageEntity.fromJson(json);
      expect(msg.kind, ChatMessageKind.serviceCard);
      expect(msg.providerServiceId, 'psrv-99');
      final card = msg.serviceCardPayload;
      expect(card, isNotNull);
      expect(card!.serviceName, 'Uốn tóc phục hồi collagen');
      expect(card.priceAmount, 350000);
      expect(card.durationMinutes, 90);
    });

    test('ChatMessageEntity parses and orders IMAGE attachments', () {
      final json = {
        'id': 'msg-image',
        'sequence': 2,
        'senderUserId': 'usr-customer',
        'kind': 'IMAGE',
        'attachments': [
          {
            'id': 'attachment-2',
            'url': 'https://example.com/second.jpg',
            'mimeType': 'image/jpeg',
            'byteSize': 2048,
            'width': 900,
            'height': 1200,
            'position': 1,
          },
          {
            'id': 'attachment-1',
            'url': 'https://example.com/first.webp',
            'mimeType': 'image/webp',
            'byteSize': 1024,
            'width': 1200,
            'height': 900,
            'position': 0,
          },
        ],
        'createdAt': '2026-10-19T10:03:00.000Z',
      };

      final message = ChatMessageEntity.fromJson(json);

      expect(message.kind, ChatMessageKind.image);
      expect(message.attachments, hasLength(2));
      expect(message.attachments.first.id, 'attachment-1');
      expect(message.attachments.first.mimeType, 'image/webp');
      expect(message.attachments.last.position, 1);
    });

    test('ChatMessageEntity parses ORDER_EVENT system message correctly', () {
      final json = {
        'id': 'msg-3',
        'sequence': 3,
        'senderUserId': null,
        'kind': 'ORDER_EVENT',
        'orderId': 'ord-888',
        'payload': {'event': 'ORDER_REQUESTED', 'orderId': 'ord-888'},
        'createdAt': '2026-10-19T10:10:00.000Z',
      };

      final msg = ChatMessageEntity.fromJson(json);
      expect(msg.kind, ChatMessageKind.orderEvent);
      expect(msg.isSystem, isTrue);
      expect(msg.orderId, 'ord-888');
      final event = msg.orderEventPayload;
      expect(event?.event, 'ORDER_REQUESTED');
      expect(event?.orderId, 'ord-888');
    });

    test('ChatConversationEntity parses correctly', () {
      final json = {
        'id': 'conv-101',
        'providerId': 'prv-5',
        'peer': {
          'id': 'prv-5',
          'displayName': 'Master Barber Tuấn',
          'avatarUrl': 'https://example.com/avatar.jpg',
        },
        'lastMessage': {
          'id': 'msg-1',
          'sequence': 1,
          'kind': 'TEXT',
          'text': 'Hẹn gặp bạn lúc 14h nhé!',
          'createdAt': '2026-10-19T10:15:00.000Z',
        },
        'lastMessageAt': '2026-10-19T10:15:00.000Z',
        'unreadCount': 2,
        'blockedByMe': false,
      };

      final conv = ChatConversationEntity.fromJson(json);
      expect(conv.id, 'conv-101');
      expect(conv.providerId, 'prv-5');
      expect(conv.peer.displayName, 'Master Barber Tuấn');
      expect(conv.peer.avatarUrl, 'https://example.com/avatar.jpg');
      expect(conv.unreadCount, 2);
      expect(conv.blockedByMe, isFalse);
      expect(conv.lastMessage?.text, 'Hẹn gặp bạn lúc 14h nhé!');
    });
  });

  group('ChatRemoteDataSource Tests', () {
    late _MockDio mockDio;
    late ChatRemoteDataSource dataSource;

    setUp(() {
      mockDio = _MockDio();
      dataSource = DioChatRemoteDataSource(mockDio);
    });

    test('getInbox returns conversations and nextCursor', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/api/me/conversations'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'items': [
              {
                'id': 'conv-1',
                'providerId': 'prv-1',
                'peer': {'id': 'prv-1', 'displayName': 'Thợ A'},
                'unreadCount': 1,
                'blockedByMe': false,
              },
            ],
            'nextCursor': 'cursor-page-2',
          },
        },
      );

      final res = await dataSource.getInbox(view: 'customer');
      expect(res.conversations.length, 1);
      expect(res.conversations.first.peer.displayName, 'Thợ A');
      expect(res.nextCursor, 'cursor-page-2');
      expect(mockDio.lastQueryParams?['view'], 'customer');
    });

    test(
      'startConversation posts payload and returns new conversation info',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/api/me/conversations'),
          statusCode: 201,
          data: {
            'success': true,
            'data': {
              'conversationId': 'conv-new-1',
              'message': {
                'id': 'msg-1',
                'sequence': 1,
                'kind': 'TEXT',
                'text': 'Tin nhắn mở hội thoại',
                'createdAt': '2026-10-19T10:00:00.000Z',
              },
            },
          },
        );

        final res = await dataSource.startConversation(
          providerId: 'prv-123',
          text: 'Tin nhắn mở hội thoại',
          clientMessageId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        );

        expect(res.conversationId, 'conv-new-1');
        expect(res.message.text, 'Tin nhắn mở hội thoại');
        expect(mockDio.lastData['providerId'], 'prv-123');
        expect(mockDio.lastData['kind'], 'TEXT');
      },
    );

    test('sendMessage sends message in existing conversation', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(
          path: '/api/me/conversations/conv-1/messages',
        ),
        statusCode: 201,
        data: {
          'success': true,
          'data': {
            'id': 'msg-2',
            'sequence': 2,
            'kind': 'TEXT',
            'text': 'Tin nhắn tiếp theo',
            'createdAt': '2026-10-19T10:02:00.000Z',
          },
        },
      );

      final msg = await dataSource.sendMessage(
        conversationId: 'conv-1',
        clientMessageId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        kind: 'TEXT',
        text: 'Tin nhắn tiếp theo',
      );

      expect(msg.id, 'msg-2');
      expect(msg.sequence, 2);
      expect(mockDio.lastPath, '/me/conversations/conv-1/messages');
    });

    test(
      'sendImages sends repeated multipart files and parses response',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(
            path: '/api/me/conversations/conv-1/images',
          ),
          statusCode: 201,
          data: {
            'success': true,
            'data': {
              'conversationId': 'conv-1',
              'message': {
                'id': 'msg-image',
                'sequence': 3,
                'kind': 'IMAGE',
                'attachments': [
                  {
                    'id': 'attachment-1',
                    'url': 'https://example.com/signed.jpg',
                    'mimeType': 'image/jpeg',
                    'byteSize': 4,
                    'width': 800,
                    'height': 600,
                    'position': 0,
                  },
                ],
                'createdAt': '2026-10-19T10:04:00.000Z',
              },
            },
          },
        );

        final message = await dataSource.sendImages(
          conversationId: 'conv-1',
          clientMessageId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          images: const [
            UploadPayload(bytes: [0xff, 0xd8, 0xff, 0x00], fileName: 'one.jpg'),
            UploadPayload(
              bytes: [0x52, 0x49, 0x46, 0x46],
              fileName: 'two.webp',
            ),
          ],
        );

        expect(mockDio.lastPath, '/me/conversations/conv-1/images');
        expect(message.kind, ChatMessageKind.image);
        expect(
          message.attachments.single.url,
          'https://example.com/signed.jpg',
        );

        final formData = mockDio.lastData as FormData;
        expect(formData.fields, hasLength(1));
        expect(formData.fields.single.key, 'clientMessageId');
        expect(
          formData.fields.single.value,
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        );
        expect(formData.files.map((entry) => entry.key), everyElement('files'));
        expect(formData.files.map((entry) => entry.value.filename), [
          'one.jpg',
          'two.webp',
        ]);
      },
    );

    test('markRead sends lastReadSequence', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(
          path: '/api/me/conversations/conv-1/read',
        ),
        statusCode: 200,
        data: {
          'success': true,
          'data': {'lastReadSequence': 10},
        },
      );

      final seq = await dataSource.markRead(
        conversationId: 'conv-1',
        lastReadSequence: 10,
      );

      expect(seq, 10);
      expect(mockDio.lastData['lastReadSequence'], 10);
    });

    test(
      'blockConversation and unblockConversation work as expected',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(
            path: '/api/me/conversations/conv-1/block',
          ),
          statusCode: 200,
          data: {
            'success': true,
            'data': {'blockedByMe': true},
          },
        );

        final blocked = await dataSource.blockConversation(
          conversationId: 'conv-1',
        );
        expect(blocked, isTrue);

        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(
            path: '/api/me/conversations/conv-1/block',
          ),
          statusCode: 200,
          data: {
            'success': true,
            'data': {'blockedByMe': false},
          },
        );

        final unblocked = await dataSource.unblockConversation(
          conversationId: 'conv-1',
        );
        expect(unblocked, isTrue);
      },
    );
  });

  group('Chat Notifiers State Tests', () {
    late _MockDio mockDio;
    late ChatRemoteDataSource dataSource;

    setUp(() {
      mockDio = _MockDio();
      dataSource = DioChatRemoteDataSource(mockDio);
    });

    test(
      'ChatInboxNotifier fetches conversations and computes totalUnreadCount',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/api/me/conversations'),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'items': [
                {
                  'id': 'conv-1',
                  'providerId': 'prv-1',
                  'peer': {'id': 'prv-1', 'displayName': 'Thợ 1'},
                  'unreadCount': 3,
                  'blockedByMe': false,
                },
                {
                  'id': 'conv-2',
                  'providerId': 'prv-2',
                  'peer': {'id': 'prv-2', 'displayName': 'Thợ 2'},
                  'unreadCount': 2,
                  'blockedByMe': false,
                },
              ],
              'nextCursor': null,
            },
          },
        );

        final notifier = ChatInboxNotifier(dataSource, 'customer');
        await Future<void>.delayed(const Duration(milliseconds: 20));

        expect(notifier.state.conversations.length, 2);
        expect(notifier.state.totalUnreadCount, 5);
      },
    );

    test(
      'ChatRoomNotifier starts conversation when conversationId is null',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/api/me/conversations'),
          statusCode: 201,
          data: {
            'success': true,
            'data': {
              'conversationId': 'conv-fresh',
              'message': {
                'id': 'msg-1',
                'sequence': 1,
                'kind': 'TEXT',
                'text': 'Chào thợ',
                'createdAt': '2026-10-19T10:00:00.000Z',
              },
            },
          },
        );

        final notifier = ChatRoomNotifier(
          dataSource,
          providerId: 'prv-999',
          peer: const ChatPeerEntity(id: 'prv-999', displayName: 'Thợ VIP'),
        );

        final sent = await notifier.sendTextMessage('Chào thợ');
        expect(sent, isTrue);
        expect(notifier.state.conversationId, 'conv-fresh');
        expect(notifier.state.messages.length, 1);
        expect(notifier.state.messages.first.text, 'Chào thợ');

        notifier.dispose();
      },
    );

    test(
      'ChatRoomNotifier polls and appends messages created by the peer',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(
            path: '/api/me/conversations/conv-live/messages',
          ),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'data': <dynamic>[],
              'meta': {'nextCursor': null},
            },
          },
        );

        final notifier = ChatRoomNotifier(
          dataSource,
          conversationId: 'conv-live',
          providerId: 'prv-live',
          peer: const ChatPeerEntity(id: 'prv-live', displayName: 'Thợ Live'),
        );
        await Future<void>.delayed(const Duration(milliseconds: 50));

        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(
            path: '/api/me/conversations/conv-live/messages',
          ),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'data': [
                {
                  'id': 'msg-from-peer',
                  'sequence': 1,
                  'senderUserId': 'provider-user',
                  'kind': 'TEXT',
                  'text': 'Tin nhắn mới',
                  'createdAt': '2026-10-19T10:20:00.000Z',
                },
              ],
              'meta': {'nextCursor': null},
            },
          },
        );

        await Future<void>.delayed(const Duration(milliseconds: 4200));

        expect(notifier.state.messages, hasLength(1));
        expect(notifier.state.messages.single.id, 'msg-from-peer');
        expect(mockDio.lastQueryParams?['afterSequence'], 0);
        notifier.dispose();
      },
    );
  });

  test(
    'chat merges send response and SSE without duplicate messages',
    () async {
      final dio = _MockDio();
      final events = _FakeChatEventsSource();
      dio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/conversations/room/messages'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'data': <dynamic>[],
            'meta': {'nextCursor': null},
          },
        },
      );
      final notifier = ChatRoomNotifier(
        DioChatRemoteDataSource(dio),
        eventsSource: events,
        conversationId: 'room',
      );
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(events.requestedAfterSequence, 0);

      final messageJson = {
        'id': 'message-1',
        'sequence': 1,
        'kind': 'TEXT',
        'text': 'Xin chào',
        'createdAt': '2026-10-26T10:00:00.000Z',
      };
      dio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/conversations/room/messages'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {'message': messageJson},
        },
      );
      expect(await notifier.sendTextMessage('Xin chào'), isTrue);
      events.controller.add(ChatMessageEntity.fromJson(messageJson));
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(notifier.state.messages, hasLength(1));
      expect(notifier.state.messages.single.id, 'message-1');
      notifier.dispose();
      await events.controller.close();
    },
  );

  test(
    'failed optimistic text retries with the same clientMessageId',
    () async {
      final dio = _MockDio();
      dio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/conversations/room/messages'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'data': <dynamic>[],
            'meta': {'nextCursor': null},
          },
        },
      );
      final notifier = ChatRoomNotifier(
        DioChatRemoteDataSource(dio),
        conversationId: 'room',
      );
      await Future<void>.delayed(const Duration(milliseconds: 30));
      dio.postError = DioException(
        requestOptions: RequestOptions(path: '/me/conversations/room/messages'),
        message: 'Offline',
      );
      expect(await notifier.sendTextMessage('Xin chào'), isFalse);
      final failed = notifier.state.messages.single;
      final firstClientId =
          (dio.lastData as Map<String, dynamic>)['clientMessageId'];
      expect(failed.hasError, isTrue);
      expect(notifier.state.highestSequence, 0);

      dio.postError = null;
      dio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/conversations/room/messages'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'message': {
              'id': 'saved-1',
              'sequence': 1,
              'kind': 'TEXT',
              'text': 'Xin chào',
              'clientMessageId': firstClientId,
              'createdAt': '2026-10-26T10:00:00.000Z',
            },
          },
        },
      );
      expect(await notifier.retryTextMessage(failed), isTrue);
      expect(
        (dio.lastData as Map<String, dynamic>)['clientMessageId'],
        firstClientId,
      );
      expect(notifier.state.messages.single.id, 'saved-1');
      notifier.dispose();
    },
  );
}
