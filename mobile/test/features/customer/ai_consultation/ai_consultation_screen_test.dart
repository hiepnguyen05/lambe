import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/ai_consultation/di/ai_consultation_providers.dart';
import 'package:mobile/features/customer/ai_consultation/domain/entities/ai_consultation_entities.dart';
import 'package:mobile/features/customer/ai_consultation/domain/repositories/ai_consultation_repository.dart';
import 'package:mobile/features/customer/ai_consultation/presentation/screens/ai_consultation_screen.dart';

void main() {
  testWidgets('shows an optimistic message while Gemini is replying', (
    tester,
  ) async {
    final repository = _ScreenFakeRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          aiConsultationRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(home: AiConsultationScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('Bạn đang muốn thay đổi điều gì?'), findsOneWidget);

    await tester.tap(find.text('Gợi ý kiểu tóc đi hẹn hò'));
    await tester.pump();

    expect(find.text('Gợi ý kiểu tóc đi hẹn hò'), findsWidgets);
    expect(find.byKey(const Key('ai-typing-indicator')), findsOneWidget);

    repository.reply.complete(
      const AiConsultationReplyEntity(
        reply: 'Side Part 6/4 là một lựa chọn gọn gàng và tự nhiên.',
        intent: 'CONSULTATION',
        nextAction: 'OFFER_PROVIDER_SEARCH',
        followUpQuestion: 'Tóc hiện tại của bạn dài khoảng bao nhiêu?',
        conversionPrompt: 'Mình có thể tìm chuyên viên phù hợp gần bạn.',
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(
      find.text('Side Part 6/4 là một lựa chọn gọn gàng và tự nhiên.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('ai-typing-indicator')), findsNothing);
    expect(
      find.text('Tóc hiện tại của bạn dài khoảng bao nhiêu?'),
      findsOneWidget,
    );
    expect(
      find.widgetWithText(
        ActionChip,
        'Tóc hiện tại của bạn dài khoảng bao nhiêu?',
      ),
      findsNothing,
    );
    expect(find.text('Tìm chuyên viên phù hợp'), findsOneWidget);
  });
}

class _ScreenFakeRepository implements AiConsultationRepository {
  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) async => throw UnimplementedError();

  final reply = Completer<AiConsultationReplyEntity>();

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
  }) => reply.future;
}
