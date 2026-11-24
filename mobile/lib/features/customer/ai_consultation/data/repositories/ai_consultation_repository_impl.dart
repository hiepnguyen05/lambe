import '../../domain/entities/ai_consultation_entities.dart';
import '../../domain/repositories/ai_consultation_repository.dart';
import '../datasources/ai_consultation_remote_datasource.dart';

class AiConsultationRepositoryImpl implements AiConsultationRepository {
  final AiConsultationRemoteDataSource _remote;

  AiConsultationRepositoryImpl(this._remote);

  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) => _remote.refreshRecommendations(
    conversationId: conversationId,
    clientMessageId: clientMessageId,
  );

  @override
  Future<String> createConversation() => _remote.createConversation();

  @override
  Future<void> deleteConversation(String conversationId) =>
      _remote.deleteConversation(conversationId);

  @override
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  }) => _remote.recordAction(
    conversationId: conversationId,
    clientMessageId: clientMessageId,
    type: type,
    targetId: targetId,
  );

  @override
  Future<List<AiConsultationMessageEntity>> getMessages(
    String conversationId,
  ) => _remote.getMessages(conversationId);

  @override
  Future<AiConsultationReplyEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String text,
    double? latitude,
    double? longitude,
    String? bookingType,
    DateTime? scheduledAt,
  }) => _remote.sendMessage(
    conversationId: conversationId,
    clientMessageId: clientMessageId,
    text: text,
    latitude: latitude,
    longitude: longitude,
    bookingType: bookingType,
    scheduledAt: scheduledAt,
  );
}
