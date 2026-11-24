import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/network_exceptions.dart';

import '../../domain/entities/ai_consultation_entities.dart';

abstract class AiConsultationRemoteDataSource {
  Future<String> createConversation();
  Future<List<AiConsultationMessageEntity>> getMessages(String id);
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  });
  Future<AiConsultationReplyEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String text,
    double? latitude,
    double? longitude,
    String? bookingType,
    DateTime? scheduledAt,
  });
  Future<void> deleteConversation(String id);
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  });
}

class DioAiConsultationRemoteDataSource
    implements AiConsultationRemoteDataSource {
  final Dio _dio;

  DioAiConsultationRemoteDataSource(this._dio);

  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.aiMessageRecommendations(conversationId, clientMessageId),
      );
      return AiConsultationReplyEntity.fromJson(
        ApiResponseParser.dataMap(response),
      );
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<String> createConversation() async {
    try {
      final response = await _dio.post(ApiEndpoints.aiConversations);
      return ApiResponseParser.dataMap(response)['id']?.toString() ?? '';
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<List<AiConsultationMessageEntity>> getMessages(String id) async {
    try {
      final response = await _dio.get(ApiEndpoints.aiConversationMessages(id));
      return ApiResponseParser.dataList(response)
          .whereType<Map>()
          .map(
            (item) => AiConsultationMessageEntity.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<AiConsultationReplyEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String text,
    double? latitude,
    double? longitude,
    String? bookingType,
    DateTime? scheduledAt,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.aiConversationMessages(conversationId),
        data: {
          'clientMessageId': clientMessageId,
          'text': text.trim(),
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (bookingType != null) 'bookingType': bookingType,
          if (scheduledAt != null)
            'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        },
      );
      return AiConsultationReplyEntity.fromJson(
        ApiResponseParser.dataMap(response),
      );
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> deleteConversation(String id) async {
    try {
      final response = await _dio.delete(ApiEndpoints.aiConversation(id));
      ApiResponseParser.ensureSuccess(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  @override
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  }) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.aiConversationActions(conversationId),
        data: {
          'clientMessageId': clientMessageId,
          'type': type,
          if (targetId != null) 'targetId': targetId,
        },
      );
      ApiResponseParser.ensureSuccess(response);
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}
