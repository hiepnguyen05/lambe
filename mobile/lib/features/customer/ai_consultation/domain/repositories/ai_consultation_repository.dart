import '../entities/ai_consultation_entities.dart';

abstract class AiConsultationRepository {
  Future<String> createConversation();

  Future<List<AiConsultationMessageEntity>> getMessages(String conversationId);

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

  Future<void> deleteConversation(String conversationId);

  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  });
}
