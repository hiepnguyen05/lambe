import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/customer/ai_consultation/application/ai_consultation_notifier.dart';
import 'package:mobile/features/customer/ai_consultation/data/datasources/ai_consultation_remote_datasource.dart';
import 'package:mobile/features/customer/ai_consultation/data/repositories/ai_consultation_repository_impl.dart';
import 'package:mobile/features/customer/ai_consultation/domain/entities/ai_consultation_entities.dart';
import 'package:mobile/features/customer/ai_consultation/domain/repositories/ai_consultation_repository.dart';
import 'package:mobile/features/customer/ai_consultation/di/ai_consultation_providers.dart';
import 'package:mobile/features/customer/ai_consultation/presentation/screens/ai_consultation_screen.dart';
import 'package:mobile/features/customer/ai_consultation/presentation/widgets/ai_message_bubble.dart';

AiConsultationReplyEntity reply(
  String id, {
  String text = 'Tư vấn',
  bool expired = false,
}) => AiConsultationReplyEntity(
  clientMessageId: id,
  reply: text,
  intent: 'CONSULTATION',
  nextAction: 'CONTINUE_CONSULTATION',
  suggestionsExpired: expired,
);

AiConsultationMessageEntity assistant(String id) => AiConsultationMessageEntity(
  id: 'assistant-$id',
  role: 'assistant',
  text: 'Tư vấn ban đầu',
  createdAt: DateTime(2026),
  result: reply(id),
);

AiConsultationMessageEntity serverMessage(AiConsultationReplyEntity result) =>
    AiConsultationMessageEntity(
      id: 'server-${result.clientMessageId}',
      role: 'assistant',
      text: 'Server text',
      createdAt: DateTime(2027),
      result: result,
    );

class RefreshRepository implements AiConsultationRepository {
  final historyRequests =
      <
        ({
          String conversationId,
          Completer<List<AiConsultationMessageEntity>> result,
        })
      >[];
  final requests =
      <
        ({
          String conversationId,
          String clientMessageId,
          Completer<AiConsultationReplyEntity> result,
        })
      >[];
  Completer<AiConsultationReplyEntity>? pendingSend;
  Completer<void>? pendingAnalytics;
  int sends = 0;
  int actions = 0;

  @override
  Future<String> createConversation() async => 'conversation-1';
  @override
  Future<AiConsultationReplyEntity> refreshRecommendations({
    required String conversationId,
    required String clientMessageId,
  }) {
    final result = Completer<AiConsultationReplyEntity>();
    requests.add((
      conversationId: conversationId,
      clientMessageId: clientMessageId,
      result: result,
    ));
    return result.future;
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
  }) {
    sends++;
    return pendingSend?.future ?? Future.value(reply(clientMessageId));
  }

  @override
  Future<List<AiConsultationMessageEntity>> getMessages(String conversationId) {
    final result = Completer<List<AiConsultationMessageEntity>>();
    historyRequests.add((conversationId: conversationId, result: result));
    return result.future;
  }

  @override
  Future<void> deleteConversation(String conversationId) async {}
  @override
  Future<void> recordAction({
    required String conversationId,
    required String clientMessageId,
    required String type,
    String? targetId,
  }) async {
    actions++;
    if (pendingAnalytics != null) return pendingAnalytics!.future;
    throw Exception('Analytics offline');
  }
}

class LoadedNotifier extends AiConsultationNotifier {
  LoadedNotifier(super.repository);
  void load(List<AiConsultationMessageEntity> messages, {String? error}) {
    state = state.copyWith(messages: messages, errorMessage: error);
  }
}

const service = AiSuggestedServiceEntity(
  id: 'service-1',
  name: 'Cắt tóc',
  slug: 'old-slug',
  minPriceAmount: 0,
  maxPriceAmount: 0,
);
const provider = AiSuggestedProviderEntity(
  id: 'provider-1',
  displayName: 'Chuyên viên',
  distanceKm: 1,
  providerServiceId: 'provider-service-1',
  priceAmount: 0,
  durationMinutes: 30,
);
const post = AiSuggestedPostEntity(
  id: 'post-1',
  providerId: 'provider-1',
  providerName: 'Chuyên viên',
  serviceName: 'Mẫu tóc',
  mediaKind: 'IMAGE',
  thumbnailUrl: null,
  mediaUrl: '',
);

AiConsultationReplyEntity recommendations({
  bool revoked = false,
  bool updated = false,
  bool expired = false,
}) => AiConsultationReplyEntity(
  clientMessageId: 'client-1',
  reply: 'Gợi ý cho bạn',
  intent: 'CONSULTATION',
  nextAction: 'SHOW_PROVIDERS',
  suggestionsExpired: revoked || expired,
  suggestedServices: revoked
      ? []
      : [
          updated
              ? const AiSuggestedServiceEntity(
                  id: 'service-1',
                  name: 'Cắt tóc',
                  slug: 'fresh-slug',
                  minPriceAmount: 80000,
                  maxPriceAmount: 0,
                )
              : service,
        ],
  suggestedProviders: [
    if (!revoked)
      updated
          ? const AiSuggestedProviderEntity(
              id: 'provider-fresh',
              displayName: 'Chuyên viên',
              distanceKm: 1,
              providerServiceId: 'provider-service-1',
              priceAmount: 120000,
              durationMinutes: 30,
            )
          : provider,
    // A different service for the same provider must not validate the old card.
    if (revoked)
      const AiSuggestedProviderEntity(
        id: 'provider-1',
        displayName: 'Dịch vụ khác',
        distanceKm: 1,
        providerServiceId: 'provider-service-other',
        priceAmount: 0,
        durationMinutes: 30,
      ),
  ],
  suggestedPosts: revoked ? [] : [post],
  nextActions: revoked
      ? []
      : const [
          AiNextActionEntity(
            type: 'VIEW_SERVICE',
            label: 'Xem dịch vụ',
            targetId: 'service-1',
          ),
          AiNextActionEntity(
            type: 'VIEW_INSPIRATION',
            label: 'Xem mẫu',
            targetId: 'post-1',
          ),
        ],
);

Future<LoadedNotifier> showRecommendations(
  WidgetTester tester,
  RefreshRepository repository,
) async {
  final notifier = LoadedNotifier(repository);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const AiConsultationScreen()),
      for (final path in [
        '/services/detail',
        '/providers/:id/public',
        '/inspiration/posts/:id',
      ])
        GoRoute(
          path: path,
          builder: (_, state) => Scaffold(body: Text('Opened ${state.uri}')),
        ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        aiConsultationNotifierProvider.overrideWith((ref) => notifier),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pump();
  notifier.load([
    AiConsultationMessageEntity(
      id: 'assistant-client-1',
      role: 'assistant',
      text: 'Gợi ý cho bạn',
      createdAt: DateTime(2026),
      result: recommendations(),
    ),
  ]);
  await tester.pump();
  return notifier;
}

void selectRecommendation(WidgetTester tester, String type) {
  final bubble = tester.widget<AiMessageBubble>(find.byType(AiMessageBubble));
  switch (type) {
    case 'service':
      bubble.onServiceSelected(service);
    case 'provider':
      bubble.onProviderSelected(provider);
    case 'post':
      bubble.onPostSelected(post);
  }
}

void main() {
  testWidgets(
    'price changes keep retained cards usable without waiting for analytics',
    (tester) async {
      final repository = RefreshRepository()
        ..pendingAnalytics = Completer<void>();
      final notifier = await showRecommendations(tester, repository);
      selectRecommendation(tester, 'service');
      repository.requests.single.result.complete(
        recommendations(updated: true, expired: true),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(
        find.text('Opened /services/detail?slug=fresh-slug'),
        findsOneWidget,
      );
      expect(repository.actions, 1);
      expect(repository.pendingAnalytics!.isCompleted, isFalse);
      expect(notifier.state.messages.single.result!.suggestionsExpired, isTrue);
      repository.pendingAnalytics!.complete();
    },
  );

  testWidgets('revoked FIND_PROVIDER action cannot send a new search', (
    tester,
  ) async {
    final repository = RefreshRepository();
    final notifier = await showRecommendations(tester, repository);
    notifier.load([
      AiConsultationMessageEntity(
        id: 'assistant-client-1',
        role: 'assistant',
        text: 'Tìm chuyên viên',
        createdAt: DateTime(2026),
        result: const AiConsultationReplyEntity(
          clientMessageId: 'client-1',
          reply: 'Tìm chuyên viên',
          intent: 'CONSULTATION',
          nextAction: 'OFFER_PROVIDER_SEARCH',
          conversionPrompt: 'Tìm người phù hợp nhé',
          nextActions: [
            AiNextActionEntity(
              type: 'FIND_PROVIDER',
              label: 'Tìm chuyên viên',
              targetId: 'service-1',
            ),
          ],
        ),
      ),
    ]);
    await tester.pump();
    tester
        .widget<AiMessageBubble>(find.byType(AiMessageBubble))
        .onFindProviders();
    repository.requests.single.result.complete(
      reply('client-1', expired: true),
    );
    await tester.pump();
    expect(repository.sends, 0);
    expect(repository.actions, 0);
    expect(notifier.state.messages, hasLength(1));
  });

  for (final type in ['service', 'provider', 'post']) {
    testWidgets('revoked $type blocks navigation after refresh', (
      tester,
    ) async {
      final repository = RefreshRepository();
      final notifier = await showRecommendations(tester, repository);
      selectRecommendation(tester, type);
      await tester.pump();
      expect(
        notifier.state.messages.single.isRefreshingRecommendations,
        isTrue,
      );
      final barrier = tester.widget<AbsorbPointer>(
        find
            .descendant(
              of: find.byType(AiMessageBubble),
              matching: find.byType(AbsorbPointer),
            )
            .first,
      );
      expect(barrier.absorbing, isTrue);
      repository.requests.single.result.complete(
        recommendations(revoked: true),
      );
      await tester.pump();
      expect(find.textContaining('Opened '), findsNothing);
      expect(
        find.textContaining('Một số gợi ý hoặc mức giá đã thay đổi.'),
        findsOneWidget,
      );
      expect(notifier.state.messages.single.result!.suggestionsExpired, isTrue);
    });

    testWidgets(
      'valid $type navigates with fresh data despite failed analytics',
      (tester) async {
        final repository = RefreshRepository();
        await showRecommendations(tester, repository);
        selectRecommendation(tester, type);
        repository.requests.single.result.complete(
          recommendations(updated: true),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
        final destination = switch (type) {
          'service' => '/services/detail?slug=fresh-slug',
          'provider' => '/providers/provider-fresh/public',
          _ => '/inspiration/posts/post-1',
        };
        expect(find.text('Opened $destination'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('failed validation blocks CTA until a manual recheck succeeds', (
    tester,
  ) async {
    final repository = RefreshRepository();
    await showRecommendations(tester, repository);
    selectRecommendation(tester, 'service');
    repository.requests.single.result.completeError(Exception('Offline'));
    await tester.pump();
    expect(find.textContaining('Opened '), findsNothing);
    expect(
      find.text('Chưa thể kiểm tra gợi ý. Bạn hãy thử lại nhé.'),
      findsWidgets,
    );
    selectRecommendation(tester, 'service');
    expect(repository.requests, hasLength(1));
    tester
        .widget<TextButton>(
          find.widgetWithText(TextButton, 'Kiểm tra lại gợi ý'),
        )
        .onPressed!();
    repository.requests.last.result.complete(recommendations(updated: true));
    await tester.pump();
    selectRecommendation(tester, 'service');
    repository.requests.last.result.complete(recommendations(updated: true));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(
      find.text('Opened /services/detail?slug=fresh-slug'),
      findsOneWidget,
    );
  });

  testWidgets('resume refresh retains list and disables cards until checked', (
    tester,
  ) async {
    final repository = RefreshRepository();
    final notifier = await showRecommendations(tester, repository);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(repository.historyRequests, hasLength(1));
    expect(repository.requests, isEmpty);
    expect(repository.sends, 0);
    expect(repository.actions, 0);
    expect(find.text('Gợi ý cho bạn'), findsOneWidget);
    selectRecommendation(tester, 'service');
    expect(repository.requests, isEmpty);
    repository.historyRequests.single.result.complete([
      assistant('client-1').copyWith(result: recommendations(revoked: true)),
    ]);
    await tester.pump();
    expect(notifier.state.messages, hasLength(1));
    expect(notifier.state.messages.single.isRefreshingRecommendations, isFalse);
    expect(notifier.state.messages.single.result!.suggestedServices, isEmpty);
    expect(
      notifier
          .state
          .messages
          .single
          .result!
          .suggestedProviders
          .single
          .providerServiceId,
      'provider-service-other',
    );
    expect(notifier.state.messages.single.result!.suggestedPosts, isEmpty);
    expect(find.textContaining('Opened '), findsNothing);
  });

  testWidgets(
    'a result absent from resume history stays blocked until manual recheck',
    (tester) async {
      final repository = RefreshRepository();
      final notifier = await showRecommendations(tester, repository);
      final refresh = notifier.refreshLoadedRecommendations();
      repository.historyRequests.single.result.complete([]);
      await refresh;
      await tester.pump();
      expect(find.text('Kiểm tra lại gợi ý'), findsOneWidget);
      expect(
        notifier.state.messages.single.recommendationsRefreshFailed,
        isTrue,
      );
      selectRecommendation(tester, 'service');
      expect(repository.requests, isEmpty);
      final barriers = tester.widgetList<AbsorbPointer>(
        find.descendant(
          of: find.byType(AiMessageBubble),
          matching: find.byType(AbsorbPointer),
        ),
      );
      expect(barriers.where((item) => item.absorbing), hasLength(3));
      tester
          .widget<TextButton>(
            find.widgetWithText(TextButton, 'Kiểm tra lại gợi ý'),
          )
          .onPressed!();
      expect(repository.requests, hasLength(1));
      repository.requests.single.result.complete(
        recommendations(revoked: true),
      );
      await tester.pump();
      expect(
        notifier.state.messages.single.recommendationsRefreshFailed,
        isFalse,
      );
      expect(notifier.state.messages.single.result!.suggestedServices, isEmpty);
      expect(find.text('Kiểm tra lại gợi ý'), findsNothing);
      expect(find.textContaining('Opened '), findsNothing);
      expect(repository.historyRequests, hasLength(1));
    },
  );

  test(
    'typed repository refresh parses the envelope and optional expiration',
    () async {
      final dio = Dio();
      addTearDown(dio.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            expect(options.method, 'GET');
            expect(
              options.path,
              '/me/ai-conversations/conversation-1/messages/client-1/recommendations',
            );
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'success': true,
                  'data': {
                    'clientMessageId': 'client-1',
                    'reply': 'Tư vấn',
                    'suggestionsExpired': true,
                  },
                },
              ),
            );
          },
        ),
      );
      final repository = AiConsultationRepositoryImpl(
        DioAiConsultationRemoteDataSource(dio),
      );
      final fresh = await repository.refreshRecommendations(
        conversationId: 'conversation-1',
        clientMessageId: 'client-1',
      );
      expect(fresh.suggestionsExpired, isTrue);
      expect(
        AiConsultationReplyEntity.fromJson({}).suggestionsExpired,
        isFalse,
      );
      expect(fresh, isNot(reply('client-1')));
    },
  );

  for (final status in [404, 409, 500]) {
    test(
      'refresh HTTP $status does not produce an actionable result',
      () async {
        final dio = Dio();
        addTearDown(dio.close);
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.badResponse,
                  response: Response(
                    requestOptions: options,
                    statusCode: status,
                    data: {'message': 'Unavailable'},
                  ),
                ),
              );
            },
          ),
        );
        await expectLater(
          DioAiConsultationRemoteDataSource(dio).refreshRecommendations(
            conversationId: 'conversation-1',
            clientMessageId: 'client-1',
          ),
          throwsA(anything),
        );
      },
    );
  }

  test(
    'refresh failure retains the snapshot and user pending/error state',
    () async {
      final repository = RefreshRepository();
      final notifier = LoadedNotifier(repository);
      addTearDown(notifier.dispose);
      await pumpEventQueue();
      final user = AiConsultationMessageEntity(
        id: 'user',
        role: 'user',
        text: 'Câu hỏi',
        createdAt: DateTime(2026),
        isPending: true,
        hasError: true,
      );
      final original = assistant('client-1');
      notifier.load([user, original], error: 'Lỗi gửi tin nhắn');
      final refresh = notifier.refreshRecommendations(original.id);
      expect(notifier.state.messages.last.isRefreshingRecommendations, isTrue);
      repository.requests.single.result.completeError(Exception('Offline'));
      expect(await refresh, isNull);
      expect(notifier.state.messages.first, same(user));
      expect(notifier.state.messages.last.result, same(original.result));
      expect(notifier.state.messages.last.recommendationsRefreshFailed, isTrue);
      expect(notifier.state.messages.last.isRefreshingRecommendations, isFalse);
      expect(notifier.state.errorMessage, 'Lỗi gửi tin nhắn');
    },
  );

  test(
    'later refresh wins even when the older response completes last',
    () async {
      final repository = RefreshRepository();
      final notifier = LoadedNotifier(repository);
      addTearDown(notifier.dispose);
      await pumpEventQueue();
      notifier.load([assistant('client-1')]);
      final older = notifier.refreshRecommendations('assistant-client-1');
      final newer = notifier.refreshRecommendations('assistant-client-1');
      final fresh = reply('client-1', expired: true);
      repository.requests[1].result.complete(fresh);
      expect(await newer, same(fresh));
      repository.requests[0].result.complete(reply('client-1'));
      expect(await older, isNull);
      expect(notifier.state.messages.single.result, same(fresh));
      expect(notifier.state.messages.single.text, 'Tư vấn ban đầu');
    },
  );

  test('wrong client result and disposed refresh fail closed', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    await pumpEventQueue();
    notifier.load([assistant('client-1')]);
    final wrong = notifier.refreshRecommendations('assistant-client-1');
    repository.requests.single.result.complete(reply('another-client'));
    expect(await wrong, isNull);
    final disposed = notifier.refreshRecommendations('assistant-client-1');
    notifier.dispose();
    repository.requests.last.result.complete(reply('client-1'));
    expect(await disposed, isNull);
  });

  test('resume fetches history once without per-result requests and preserves pending sends', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    addTearDown(notifier.dispose);
    await pumpEventQueue();
    final failedUser = AiConsultationMessageEntity(
      id: 'failed-user',
      role: 'user',
      text: 'Câu hỏi trước',
      createdAt: DateTime(2026),
      hasError: true,
    );
    notifier.load([
      failedUser,
      for (var i = 0; i < 7; i++) assistant('client-$i'),
    ]);
    final refresh = notifier.refreshLoadedRecommendations();
    final repeated = notifier.refreshLoadedRecommendations();
    expect(identical(refresh, repeated), isTrue);
    expect(repository.historyRequests, hasLength(1));
    expect(repository.historyRequests.single.conversationId, 'conversation-1');
    expect(repository.requests, isEmpty);
    expect(
      notifier.state.messages
          .where((item) => !item.isUser)
          .every((item) => item.isRefreshingRecommendations),
      isTrue,
    );
    repository.pendingSend = Completer<AiConsultationReplyEntity>();
    final send = notifier.sendMessage('Câu hỏi tiếp theo');
    await pumpEventQueue();
    final pendingUser = notifier.state.messages.last;
    repository.historyRequests.single.result.complete([
      for (var i = 6; i >= 0; i--)
        serverMessage(reply('client-$i', expired: true)),
    ]);
    await refresh;
    expect(repository.requests, isEmpty);
    expect(repository.sends, 1);
    expect(repository.actions, 0);
    expect(notifier.state.isSending, isTrue);
    expect(notifier.state.messages.last, same(pendingUser));
    expect(notifier.state.messages.first, same(failedUser));
    for (var i = 0; i < 7; i++) {
      final message = notifier.state.messages[i + 1];
      expect(message.id, 'assistant-client-$i');
      expect(message.text, 'Tư vấn ban đầu');
      expect(message.createdAt, DateTime(2026));
      expect(message.result!.clientMessageId, 'client-$i');
      expect(message.result!.suggestionsExpired, isTrue);
    }
    repository.pendingSend!.complete(reply(pendingUser.id));
    expect(await send, isTrue);
    expect(notifier.state.messages, hasLength(10));
    expect(
      notifier.state.messages.where((item) => item.isRefreshingRecommendations),
      isEmpty,
    );
  });

  test('older loaded results missing from latest 50 require manual recheck without a request burst', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    addTearDown(notifier.dispose);
    await pumpEventQueue();
    notifier.load([for (var i = 0; i < 55; i++) assistant('client-$i')]);
    final refresh = notifier.refreshLoadedRecommendations();
    expect(repository.historyRequests, hasLength(1));
    expect(repository.requests, isEmpty);
    expect(
      notifier.state.messages.every((item) => item.isRefreshingRecommendations),
      isTrue,
    );
    repository.historyRequests.single.result.complete([
      for (var i = 30; i < 55; i++) ...[
        AiConsultationMessageEntity(
          id: 'server-user-$i',
          role: 'user',
          text: 'Câu hỏi',
          createdAt: DateTime(2026),
        ),
        serverMessage(reply('client-$i', expired: true)),
      ],
    ]);
    await refresh;
    expect(repository.requests, isEmpty);
    expect(repository.historyRequests, hasLength(1));
    expect(notifier.state.messages, hasLength(55));
    expect(
      notifier.state.messages.every(
        (item) => !item.isRefreshingRecommendations,
      ),
      isTrue,
    );
    expect(
      notifier.state.messages
          .take(30)
          .every((item) => item.recommendationsRefreshFailed),
      isTrue,
    );
    expect(
      notifier.state.messages
          .skip(30)
          .every(
            (item) =>
                !item.recommendationsRefreshFailed &&
                item.result!.suggestionsExpired,
          ),
      isTrue,
    );
    final retry = notifier.refreshRecommendations('assistant-client-0');
    repository.requests.single.result.complete(
      reply('client-0', expired: true),
    );
    await retry;
    expect(notifier.state.messages.first.recommendationsRefreshFailed, isFalse);
    expect(repository.historyRequests, hasLength(1));
  });

  test('resume merges changed recommendations by clientMessageId while preserving local identity and errors', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    addTearDown(notifier.dispose);
    await pumpEventQueue();
    final original = assistant('client-1')
        .copyWith(result: recommendations(), isPending: true, hasError: true);
    final failedUser = AiConsultationMessageEntity(
      id: 'user-error',
      role: 'user',
      text: 'Lỗi gửi',
      createdAt: DateTime(2026),
      hasError: true,
    );
    notifier.load([failedUser, original], error: 'Lỗi gửi tin nhắn');
    final refresh = notifier.refreshLoadedRecommendations();
    final changed = recommendations(updated: true, expired: true);
    repository.historyRequests.single.result.complete([
      serverMessage(changed),
      serverMessage(reply('unloaded')),
    ]);
    await refresh;
    expect(notifier.state.messages, hasLength(2));
    expect(notifier.state.messages.first, same(failedUser));
    final updated = notifier.state.messages.last;
    expect(updated.id, original.id);
    expect(updated.text, original.text);
    expect(updated.createdAt, original.createdAt);
    expect(updated.hasError, isTrue);
    expect(updated.isPending, isTrue);
    expect(updated.result, same(changed));
    expect(updated.result!.suggestedServices.single.minPriceAmount, 80000);
    expect(updated.result!.suggestedProviders.single.priceAmount, 120000);
    expect(notifier.state.errorMessage, 'Lỗi gửi tin nhắn');
    expect(repository.requests, isEmpty);
  });

  test('history failure preserves the list and marks every assistant for manual recheck', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    addTearDown(notifier.dispose);
    await pumpEventQueue();
    final original = assistant('client-1');
    notifier.load([original], error: 'Lỗi gửi tin nhắn');
    final refresh = notifier.refreshLoadedRecommendations();
    repository.historyRequests.single.result.completeError(
      Exception('Offline'),
    );
    await refresh;
    expect(notifier.state.messages.single.result, same(original.result));
    expect(notifier.state.messages.single.recommendationsRefreshFailed, isTrue);
    expect(notifier.state.messages.single.isRefreshingRecommendations, isFalse);
    expect(notifier.state.errorMessage, 'Lỗi gửi tin nhắn');
    expect(repository.requests, isEmpty);
  });

  for (final individualCompletesFirst in [true, false]) {
    test(
      'individual refresh supersedes overlapping history, individual completes first: $individualCompletesFirst',
      () async {
        final repository = RefreshRepository();
        final notifier = LoadedNotifier(repository);
        addTearDown(notifier.dispose);
        await pumpEventQueue();
        notifier.load([assistant('client-1'), assistant('client-2')]);
        final background = notifier.refreshLoadedRecommendations();
        final individual = notifier.refreshRecommendations(
          'assistant-client-1',
        );
        final newest = reply('client-1', expired: true);
        if (individualCompletesFirst) {
          repository.requests.single.result.complete(newest);
          expect(await individual, same(newest));
        }
        repository.historyRequests.single.result.complete([
          serverMessage(reply('client-1')),
          serverMessage(reply('client-2', expired: true)),
        ]);
        await background;
        if (!individualCompletesFirst) {
          expect(
            notifier.state.messages.first.isRefreshingRecommendations,
            isTrue,
          );
          repository.requests.single.result.complete(newest);
          expect(await individual, same(newest));
        }
        expect(notifier.state.messages.first.result, same(newest));
        expect(
          notifier.state.messages.first.isRefreshingRecommendations,
          isFalse,
        );
        expect(
          notifier.state.messages.first.recommendationsRefreshFailed,
          isFalse,
        );
        expect(notifier.state.messages.last.result!.suggestionsExpired, isTrue);
        expect(repository.historyRequests, hasLength(1));
        expect(repository.requests, hasLength(1));
      },
    );
  }

  test(
    'resume does not supersede an individual check already in flight',
    () async {
      final repository = RefreshRepository();
      final notifier = LoadedNotifier(repository);
      addTearDown(notifier.dispose);
      await pumpEventQueue();
      notifier.load([assistant('client-1'), assistant('client-2')]);
      final individual = notifier.refreshRecommendations('assistant-client-1');
      final background = notifier.refreshLoadedRecommendations();
      repository.historyRequests.single.result.complete([
        serverMessage(reply('client-1')),
        serverMessage(reply('client-2')),
      ]);
      await background;
      expect(notifier.state.messages.first.isRefreshingRecommendations, isTrue);
      final newest = reply('client-1', expired: true);
      repository.requests.single.result.complete(newest);
      expect(await individual, same(newest));
      expect(notifier.state.messages.first.result, same(newest));
    },
  );

  test(
    'history identity guard preserves replaced and newly delivered results',
    () async {
      final repository = RefreshRepository();
      final notifier = LoadedNotifier(repository);
      addTearDown(notifier.dispose);
      await pumpEventQueue();
      final original = assistant('client-1');
      notifier.load([original]);
      final background = notifier.refreshLoadedRecommendations();
      final newest = reply('client-1', expired: true);
      notifier.load([original.copyWith(result: newest)]);
      await notifier.sendMessage('Câu hỏi mới');
      final newlyDelivered = notifier.state.messages.last;
      repository.historyRequests.single.result.complete([
        serverMessage(reply('client-1')),
      ]);
      await background;
      expect(notifier.state.messages, hasLength(3));
      expect(notifier.state.messages.first.result, same(newest));
      expect(notifier.state.messages.last, same(newlyDelivered));
      expect(notifier.state.isSending, isFalse);
    },
  );

  test('history completing after disposal does not update state', () async {
    final repository = RefreshRepository();
    final notifier = LoadedNotifier(repository);
    await pumpEventQueue();
    notifier.load([assistant('client-1')]);
    final background = notifier.refreshLoadedRecommendations();
    notifier.dispose();
    repository.historyRequests.single.result.complete([
      serverMessage(reply('client-1')),
    ]);
    await background;
  });
}
