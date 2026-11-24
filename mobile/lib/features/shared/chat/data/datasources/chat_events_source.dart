import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:mobile/core/constants/api_endpoints.dart';

import '../../domain/entities/chat_message_entity.dart';

abstract class ChatEventsSource {
  Stream<ChatMessageEntity> watch({
    required String conversationId,
    required int afterSequence,
    required CancelToken cancelToken,
    required void Function() onConnected,
  });
}

class DioChatEventsSource implements ChatEventsSource {
  final Dio _dio;

  DioChatEventsSource(this._dio);

  @override
  Stream<ChatMessageEntity> watch({
    required String conversationId,
    required int afterSequence,
    required CancelToken cancelToken,
    required void Function() onConnected,
  }) async* {
    final response = await _dio.get<ResponseBody>(
      ApiEndpoints.meConversationEvents(conversationId),
      queryParameters: {'afterSequence': afterSequence},
      cancelToken: cancelToken,
      options: Options(
        responseType: ResponseType.stream,
        receiveTimeout: Duration.zero,
        headers: {'Accept': 'text/event-stream'},
      ),
    );
    final body = response.data;
    if (body == null) throw const FormatException('Empty chat event stream');
    onConnected();
    await for (final line
        in utf8.decoder.bind(body.stream).transform(const LineSplitter())) {
      if (cancelToken.isCancelled) break;
      if (!line.startsWith('data: ')) continue;
      final payload = jsonDecode(line.substring(6));
      if (payload is Map<String, dynamic>) {
        yield ChatMessageEntity.fromJson(payload);
      }
    }
  }
}
