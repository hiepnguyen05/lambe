import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/ai_consultation/application/ai_consultation_notifier.dart';
import 'package:mobile/features/customer/ai_consultation/domain/entities/ai_consultation_entities.dart';
import 'package:mobile/features/customer/ai_consultation/domain/repositories/ai_consultation_repository.dart';

void main() {
  test('parses service and provider suggestions from the API response', () {
    final reply = AiConsultationReplyEntity.fromJson({
      'reply': 'Side Part 6/4 sẽ giúp khuôn mặt trông cân đối hơn.',
      'intent': 'PROVIDER_SEARCH',
      'nextAction': 'SHOW_PROVIDERS',
      'clientMessageId': 'client-1',
      'nextActions': [
        {'type': 'VIEW_INSPIRATION', 'label': 'Xem mẫu', 'targetId': 'post-1'},
      ],
      'suggestedPosts': [
        {
          'id': 'post-1',
          'provider': {'id': 'provider-1', 'displayName': 'Nguyễn Văn An'},
          'service': {'id': 'service-1', 'name': 'Cắt tóc nam'},
          'mediaKind': 'IMAGE',
          'thumbnailUrl': 'https://example.com/sample.jpg',
          'mediaUrl': 'https://example.com/sample.jpg',
        },
      ],
      'conversionPrompt': 'Mình có thể tìm chuyên viên gần bạn.',
      'degradedMode': false,
      'suggestedServices': [
        {
          'id': 'service-1',
          'name': 'Cắt tóc nam',
          'minPriceAmount': 80000,
          'maxPriceAmount': 180000,
          'currencyCode': 'VND',
        },
      ],
      'suggestedProviders': [
        {
          'id': 'provider-1',
          'displayName': 'Nguyễn Văn An',
          'biography': 'Chuyên tóc nam hiện đại',
          'experienceYears': 6,
          'serviceAreaName': 'Quận 1',
          'distanceKm': 2.4,
          'estimatedTravelFeeAmount': 12000,
          'available': true,
          'service': {
            'id': 'provider-service-1',
            'priceAmount': 120000,
            'durationMinutes': 45,
            'service': {'name': 'Cắt tóc nam'},
          },
        },
      ],
    });

    expect(reply.suggestedServices.single.name, 'Cắt tóc nam');
    expect(
      reply.suggestedProviders.single.providerServiceId,
      'provider-service-1',
    );
    expect(reply.suggestedProviders.single.distanceKm, 2.4);
    expect(reply.conversionPrompt, 'Mình có thể tìm chuyên viên gần bạn.');
    expect(reply.suggestedProviders.single.serviceName, 'Cắt tóc nam');
    expect(reply.suggestedProviders.single.experienceYears, 6);
    expect(reply.suggestedProviders.single.estimatedTravelFeeAmount, 12000);
    expect(reply.clientMessageId, 'client-1');
    expect(reply.suggestedPosts.single.id, 'post-1');
    expect(reply.nextActions.single.targetId, 'post-1');
  });

  test(
    'shows the customer message immediately while waiting for Gemini',
    () async {
      final repository = _FakeAiConsultationRepository();
      final notifier = AiConsultationNotifier(repository);
      await pumpEventQueue();

      final send = notifier.sendMessage('Gợi ý kiểu tóc để đi hẹn hò');

      expect(notifier.state.isSending, isTrue);
      expect(notifier.state.messages, hasLength(1));
      expect(notifier.state.messages.single.isUser, isTrue);

      repository.pendingReply.complete(
        const AiConsultationReplyEntity(
          reply: 'Bạn có thể thử Side Part 6/4.',
          intent: 'CONSULTATION',
          nextAction: 'CONTINUE_CONSULTATION',
        ),
      );
      expect(await send, isTrue);
      expect(notifier.state.isSending, isFalse);
      expect(notifier.state.messages, hasLength(2));
      expect(
        notifier.state.messages.last.text,
        'Bạn có thể thử Side Part 6/4.',
      );

      notifier.dispose();
    },
  );

  test('passes current location only when explicitly requested', () async {
    final repository = _FakeAiConsultationRepository();
    final notifier = AiConsultationNotifier(repository);
    await pumpEventQueue();

    final send = notifier.sendMessage(
      'Tìm chuyên viên gần tôi',
      latitude: 10.7731,
      longitude: 106.703,
    );
    repository.pendingReply.complete(
      const AiConsultationReplyEntity(
        reply: 'Mình đã tìm được chuyên viên phù hợp.',
        intent: 'PROVIDER_SEARCH',
        nextAction: 'SHOW_PROVIDERS',
      ),
    );
    await send;

    expect(repository.latitude, 10.7731);
    expect(repository.longitude, 106.703);
    notifier.dispose();
  });

  test('retries a failed message with the same id and location', () async {
    final repository = _RetryRepository();
    final notifier = AiConsultationNotifier(repository);
    await pumpEventQueue();

    expect(
      await notifier.sendMessage(
        'Tìm thợ gần đây',
        latitude: 10.7731,
        longitude: 106.703,
      ),
      isFalse,
    );
    final failed = notifier.state.messages.single;
    expect(failed.hasError, isTrue);

    expect(await notifier.retryMessage(failed.id), isTrue);
    expect(repository.messageIds, [failed.id, failed.id]);
    expect(repository.latitudes, [10.7731, 10.7731]);
    expect(notifier.state.messages.last.text, 'Đã tìm thấy chuyên viên.');
    notifier.dispose();
  });
}

class _RetryRepository implements AiConsultationRepository {
  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) async => throw UnimplementedError();

  final messageIds = <String>[];
  final latitudes = <double?>[];

  @override
  Future<String> createConversation() async => 'conversation-1';

  @override
  Future<void> deleteConversation(String conversationId) async {}

  @override
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  }) async {}

  @override
  Future<List<AiConsultationMessageEntity>> getMessages(
    String conversationId,
  ) async => const [];

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
    messageIds.add(clientMessageId);
    latitudes.add(latitude);
    if (messageIds.length == 1) throw Exception('Kết nối gián đoạn');
    return const AiConsultationReplyEntity(
      reply: 'Đã tìm thấy chuyên viên.',
      intent: 'PROVIDER_SEARCH',
      nextAction: 'SHOW_PROVIDERS',
    );
  }
}

class _FakeAiConsultationRepository implements AiConsultationRepository {
  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) async => throw UnimplementedError();

  final pendingReply = Completer<AiConsultationReplyEntity>();
  double? latitude;
  double? longitude;

  @override
  Future<String> createConversation() async => 'conversation-1';

  @override
  Future<void> deleteConversation(String conversationId) async {}

  @override
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  }) async {}

  @override
  Future<List<AiConsultationMessageEntity>> getMessages(
    String conversationId,
  ) async => const [];

  @override
  Future<AiConsultationReplyEntity> sendMessage({
    required String conversationId,
    required String clientMessageId,
    required String text,
    double? latitude,
    double? longitude,
    String? bookingType,
    DateTime? scheduledAt,
  }) {
    this.latitude = latitude;
    this.longitude = longitude;
    return pendingReply.future;
  }
}
