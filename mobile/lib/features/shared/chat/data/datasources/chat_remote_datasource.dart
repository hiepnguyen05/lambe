import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/upload_payload.dart';

import '../../domain/entities/chat_conversation_entity.dart';
import '../../domain/entities/chat_message_entity.dart';

abstract class ChatRemoteDataSource {
  Future<({String conversationId, bool created, ChatMessageEntity message})>
  startConversation({
    required String providerId,
    required String text,
    required String clientMessageId,
  });

  Future<({List<ChatConversationEntity> conversations, String? nextCursor})>
  getInbox({
    required String view, // 'customer' | 'provider'
    String? cursor,
    int limit = 20,
  });

  Future<({List<ChatMessageEntity> messages, int? nextCursor})> getMessages({
    required String conversationId,
    int? beforeSequence,
    int? afterSequence,
    int limit = 50,
  });

  Future<ChatMessageEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String kind, // 'TEXT' | 'SERVICE_CARD'
    String? text,
    String? providerServiceId,
  });

  Future<ChatMessageEntity> sendImages({
    required String conversationId,
    required String clientMessageId,
    required List<UploadPayload> images,
  });

  Future<int> markRead({
    required String conversationId,
    required int lastReadSequence,
  });

  Future<bool> blockConversation({required String conversationId});

  Future<bool> unblockConversation({required String conversationId});

  Future<String> reportConversation({
    required String conversationId,
    required String reason,
    String? messageId,
    String? detail,
  });
}

class DioChatRemoteDataSource implements ChatRemoteDataSource {
  final Dio _dio;

  DioChatRemoteDataSource(this._dio);

  String _extractError(DioException e, {required String fallback}) {
    final resData = e.response?.data;
    if (resData is Map<String, dynamic>) {
      final msg = resData['message'];
      if (msg is String && msg.isNotEmpty) {
        return msg;
      } else if (msg is List && msg.isNotEmpty) {
        return msg.first.toString();
      }
    }
    return e.message ?? fallback;
  }

  @override
  Future<({String conversationId, bool created, ChatMessageEntity message})>
  startConversation({
    required String providerId,
    required String text,
    required String clientMessageId,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.meConversations,
        data: {
          'providerId': providerId,
          'clientMessageId': clientMessageId,
          'kind': 'TEXT',
          'text': text.trim(),
        },
      );
      final data = ApiResponseParser.dataMap(response);
      final conversationId = data['conversationId']?.toString() ?? '';
      final created = data['created'] == true;
      final messageJson = data['message'] as Map<String, dynamic>? ?? {};
      final message = ChatMessageEntity.fromJson(messageJson);

      return (
        conversationId: conversationId,
        created: created,
        message: message,
      );
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể mở cuộc trò chuyện.'),
      );
    }
  }

  @override
  Future<({List<ChatConversationEntity> conversations, String? nextCursor})>
  getInbox({required String view, String? cursor, int limit = 20}) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meConversations,
        queryParameters: {
          'view': view,
          if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
          'limit': limit,
        },
      );
      final resMap = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : {};
      final rawData = resMap['data'];

      List<dynamic> list;
      String? nextCursor;

      if (rawData is Map<String, dynamic>) {
        final innerList = rawData['data'] ?? rawData['items'];
        list = innerList is List ? innerList : [];
        final meta =
            rawData['meta'] as Map<String, dynamic>? ??
            resMap['meta'] as Map<String, dynamic>?;
        nextCursor =
            (meta?['nextCursor'] ??
                    rawData['nextCursor'] ??
                    resMap['nextCursor'])
                ?.toString();
      } else if (rawData is List) {
        list = rawData;
        final meta = resMap['meta'] as Map<String, dynamic>?;
        nextCursor = (meta?['nextCursor'] ?? resMap['nextCursor'])?.toString();
      } else {
        list = [];
      }

      final conversations = list
          .whereType<Map<String, dynamic>>()
          .map((json) => ChatConversationEntity.fromJson(json))
          .toList();

      return (conversations: conversations, nextCursor: nextCursor);
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể tải danh sách tin nhắn.'),
      );
    }
  }

  @override
  Future<({List<ChatMessageEntity> messages, int? nextCursor})> getMessages({
    required String conversationId,
    int? beforeSequence,
    int? afterSequence,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.meConversationMessages(conversationId),
        queryParameters: {
          if (beforeSequence != null) 'beforeSequence': beforeSequence,
          if (afterSequence != null) 'afterSequence': afterSequence,
          'limit': limit,
        },
      );
      final resMap = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : {};
      final rawData = resMap['data'];

      List<dynamic> list;
      int? nextCursor;

      if (rawData is Map<String, dynamic>) {
        final innerList = rawData['data'] ?? rawData['items'];
        list = innerList is List ? innerList : [];
        final meta =
            rawData['meta'] as Map<String, dynamic>? ??
            resMap['meta'] as Map<String, dynamic>?;
        nextCursor = (meta?['nextCursor'] as num?)?.toInt();
      } else if (rawData is List) {
        list = rawData;
        final meta = resMap['meta'] as Map<String, dynamic>?;
        nextCursor = (meta?['nextCursor'] as num?)?.toInt();
      } else {
        list = [];
      }

      final messages = list
          .whereType<Map<String, dynamic>>()
          .map((json) => ChatMessageEntity.fromJson(json))
          .toList();

      return (messages: messages, nextCursor: nextCursor);
    } on DioException catch (e) {
      throw Exception(_extractError(e, fallback: 'Không thể tải tin nhắn.'));
    }
  }

  @override
  Future<ChatMessageEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String kind,
    String? text,
    String? providerServiceId,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.meConversationMessages(conversationId),
        data: {
          'clientMessageId': clientMessageId,
          'kind': kind,
          if (text != null && text.isNotEmpty) 'text': text.trim(),
          if (providerServiceId != null) 'providerServiceId': providerServiceId,
        },
      );
      final data = ApiResponseParser.dataMap(response);
      final messageJson = data['message'] is Map<String, dynamic>
          ? data['message'] as Map<String, dynamic>
          : data;
      return ChatMessageEntity.fromJson(messageJson);
    } on DioException catch (e) {
      throw Exception(_extractError(e, fallback: 'Không thể gửi tin nhắn.'));
    }
  }

  @override
  Future<ChatMessageEntity> sendImages({
    required String conversationId,
    required String clientMessageId,
    required List<UploadPayload> images,
  }) async {
    try {
      final formData = FormData();
      formData.fields.add(MapEntry('clientMessageId', clientMessageId));
      for (final image in images) {
        formData.files.add(
          MapEntry(
            'files',
            MultipartFile.fromBytes(image.bytes, filename: image.fileName),
          ),
        );
      }
      final response = await _dio.post(
        ApiEndpoints.meConversationImages(conversationId),
        data: formData,
      );
      final data = ApiResponseParser.dataMap(response);
      final messageJson = data['message'] is Map<String, dynamic>
          ? data['message'] as Map<String, dynamic>
          : data;
      return ChatMessageEntity.fromJson(messageJson);
    } on DioException catch (e) {
      throw Exception(_extractError(e, fallback: 'Không thể gửi ảnh.'));
    }
  }

  @override
  Future<int> markRead({
    required String conversationId,
    required int lastReadSequence,
  }) async {
    try {
      final response = await _dio.patch(
        ApiEndpoints.meConversationRead(conversationId),
        data: {'lastReadSequence': lastReadSequence},
      );
      final data = ApiResponseParser.dataMap(response);
      return (data['lastReadSequence'] as num?)?.toInt() ?? lastReadSequence;
    } on DioException catch (e) {
      throw Exception(_extractError(e, fallback: 'Không thể cập nhật đã đọc.'));
    }
  }

  @override
  Future<bool> blockConversation({required String conversationId}) async {
    try {
      final response = await _dio.put(
        ApiEndpoints.meConversationBlock(conversationId),
      );
      final data = ApiResponseParser.dataMap(response);
      return data['blockedByMe'] == true;
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể chặn cuộc trò chuyện.'),
      );
    }
  }

  @override
  Future<bool> unblockConversation({required String conversationId}) async {
    try {
      final response = await _dio.delete(
        ApiEndpoints.meConversationBlock(conversationId),
      );
      final data = ApiResponseParser.dataMap(response);
      return data['blockedByMe'] != true;
    } on DioException catch (e) {
      throw Exception(_extractError(e, fallback: 'Không thể bỏ chặn.'));
    }
  }

  @override
  Future<String> reportConversation({
    required String conversationId,
    required String reason,
    String? messageId,
    String? detail,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.meConversationReports(conversationId),
        data: {
          'reason': reason,
          if (messageId != null) 'messageId': messageId,
          if (detail != null && detail.isNotEmpty) 'detail': detail.trim(),
        },
      );
      final data = ApiResponseParser.dataMap(response);
      return data['id']?.toString() ?? '';
    } on DioException catch (e) {
      throw Exception(
        _extractError(e, fallback: 'Không thể gửi báo cáo vi phạm.'),
      );
    }
  }
}
