import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/utils/uuid_utils.dart';

import '../domain/entities/ai_consultation_entities.dart';
import '../domain/repositories/ai_consultation_repository.dart';

class AiConsultationState {
  final String? conversationId;
  final List<AiConsultationMessageEntity> messages;
  final bool isInitializing;
  final bool isSending;
  final String? errorMessage;

  const AiConsultationState({
    this.conversationId,
    this.messages = const [],
    this.isInitializing = true,
    this.isSending = false,
    this.errorMessage,
  });

  AiConsultationState copyWith({
    String? conversationId,
    List<AiConsultationMessageEntity>? messages,
    bool? isInitializing,
    bool? isSending,
    String? errorMessage,
  }) {
    return AiConsultationState(
      conversationId: conversationId ?? this.conversationId,
      messages: messages ?? this.messages,
      isInitializing: isInitializing ?? this.isInitializing,
      isSending: isSending ?? this.isSending,
      errorMessage: errorMessage,
    );
  }
}

class AiConsultationNotifier extends StateNotifier<AiConsultationState> {
  final AiConsultationRepository _repository;
  final Map<
    String,
    ({
      double? latitude,
      double? longitude,
      String? bookingType,
      DateTime? scheduledAt,
    })
  >
  _messageLocations = {};
  late Future<void> _ready;
  final Map<String, int> _refreshVersions = {};
  Future<void>? _backgroundRefresh;

  AiConsultationNotifier(this._repository)
    : super(const AiConsultationState()) {
    _ready = _initialize();
  }

  Future<void> _initialize() async {
    try {
      final id = await _repository.createConversation();
      if (id.isEmpty) throw const FormatException('Thiếu mã hội thoại.');
      if (!mounted) return;
      state = state.copyWith(
        conversationId: id,
        isInitializing: false,
        errorMessage: null,
      );
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        isInitializing: false,
        errorMessage: _message(error),
      );
    }
  }

  Future<void> retryInitialization() async {
    if (state.isInitializing) return;
    state = state.copyWith(isInitializing: true, errorMessage: null);
    _ready = _initialize();
    await _ready;
  }

  Future<bool> sendMessage(
    String text, {
    double? latitude,
    double? longitude,
    String? bookingType,
    DateTime? scheduledAt,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isSending) return false;
    final clientMessageId = UuidUtils.generateV4();
    _messageLocations[clientMessageId] = (
      latitude: latitude,
      longitude: longitude,
      bookingType: bookingType,
      scheduledAt: scheduledAt,
    );
    final optimistic = AiConsultationMessageEntity(
      id: clientMessageId,
      role: 'user',
      text: trimmed,
      createdAt: DateTime.now(),
      isPending: true,
    );
    state = state.copyWith(
      messages: [...state.messages, optimistic],
      isSending: true,
      errorMessage: null,
    );

    return _deliver(clientMessageId, trimmed);
  }

  Future<bool> retryMessage(String clientMessageId) async {
    if (state.isSending) return false;
    final matches = state.messages.where(
      (message) => message.id == clientMessageId && message.hasError,
    );
    if (matches.isEmpty) return false;
    state = state.copyWith(
      messages: state.messages
          .map(
            (item) => item.id == clientMessageId
                ? item.copyWith(isPending: true, hasError: false)
                : item,
          )
          .toList(growable: false),
      isSending: true,
      errorMessage: null,
    );
    return _deliver(clientMessageId, matches.first.text);
  }

  Future<bool> _deliver(String clientMessageId, String text) async {
    await _ready;
    if (!mounted) return false;
    final conversationId = state.conversationId;
    if (conversationId == null) {
      state = state.copyWith(
        messages: state.messages
            .map(
              (item) => item.id == clientMessageId
                  ? item.copyWith(isPending: false, hasError: true)
                  : item,
            )
            .toList(growable: false),
        isSending: false,
        errorMessage: state.errorMessage ?? 'Không thể mở phiên tư vấn.',
      );
      return false;
    }

    try {
      final location = _messageLocations[clientMessageId];
      final reply = await _repository.sendMessage(
        conversationId: conversationId,
        clientMessageId: clientMessageId,
        text: text,
        latitude: location?.latitude,
        longitude: location?.longitude,
        bookingType: location?.bookingType,
        scheduledAt: location?.scheduledAt,
      );
      if (!mounted) return false;
      _messageLocations.remove(clientMessageId);
      final sentMessages = state.messages
          .map(
            (item) => item.id == clientMessageId
                ? item.copyWith(isPending: false, hasError: false)
                : item,
          )
          .toList(growable: false);
      final assistant = AiConsultationMessageEntity(
        id: 'assistant-$clientMessageId',
        role: 'assistant',
        text: reply.reply,
        createdAt: DateTime.now(),
        result: reply,
      );
      state = state.copyWith(
        messages: [...sentMessages, assistant],
        isSending: false,
        errorMessage: null,
      );
      return true;
    } catch (error) {
      if (!mounted) return false;
      state = state.copyWith(
        messages: state.messages
            .map(
              (item) => item.id == clientMessageId
                  ? item.copyWith(isPending: false, hasError: true)
                  : item,
            )
            .toList(growable: false),
        isSending: false,
        errorMessage: _message(error),
      );
      return false;
    }
  }

  void clearError() {
    if (state.errorMessage != null) {
      state = state.copyWith(errorMessage: null);
    }
  }

  Future<AiConsultationReplyEntity?> refreshRecommendations(
    String messageId,
  ) async {
    final message = state.messages
        .where((item) => item.id == messageId && !item.isUser)
        .firstOrNull;
    final conversationId = state.conversationId;
    if (message?.result == null || conversationId == null) return null;
    final version = _beginRefresh(message!);
    return _refresh(message, conversationId, version);
  }

  int _beginRefresh(AiConsultationMessageEntity message) {
    final version = (_refreshVersions[message.id] ?? 0) + 1;
    _refreshVersions[message.id] = version;
    _replaceMessage(
      message.id,
      (item) => item.copyWith(
        isRefreshingRecommendations: true,
        recommendationsRefreshFailed: false,
      ),
    );
    return version;
  }

  Future<AiConsultationReplyEntity?> _refresh(
    AiConsultationMessageEntity message,
    String conversationId,
    int version,
  ) async {
    bool isCurrent() => _isRefreshCurrent(message, conversationId, version);
    if (!isCurrent()) return null;
    try {
      final clientMessageId = message.result!.clientMessageId;
      if (clientMessageId.isEmpty) throw const FormatException();
      final reply = await _repository.refreshRecommendations(
        conversationId: conversationId,
        clientMessageId: clientMessageId,
      );
      if (!isCurrent()) return null;
      if (reply.clientMessageId != clientMessageId) {
        throw const FormatException('Mã phản hồi không khớp.');
      }
      _replaceMessage(
        message.id,
        (item) => item.copyWith(
          result: reply,
          isRefreshingRecommendations: false,
          recommendationsRefreshFailed: false,
        ),
      );
      return reply;
    } catch (_) {
      if (isCurrent()) {
        _replaceMessage(
          message.id,
          (item) => item.copyWith(
            isRefreshingRecommendations: false,
            recommendationsRefreshFailed: true,
          ),
        );
      }
      return null;
    }
  }

  bool _isRefreshCurrent(
    AiConsultationMessageEntity message,
    String conversationId,
    int version,
  ) =>
      mounted &&
      state.conversationId == conversationId &&
      _refreshVersions[message.id] == version &&
      state.messages.any(
        (item) =>
            item.id == message.id && identical(item.result, message.result),
      );

  void _replaceMessage(
    String id,
    AiConsultationMessageEntity Function(AiConsultationMessageEntity) update,
  ) {
    state = state.copyWith(
      messages: state.messages
          .map((item) => item.id == id ? update(item) : item)
          .toList(growable: false),
      errorMessage: state.errorMessage,
    );
  }

  Future<void> refreshLoadedRecommendations() {
    return _backgroundRefresh ??= _refreshLoadedRecommendations().whenComplete(
      () => _backgroundRefresh = null,
    );
  }

  Future<void> _refreshLoadedRecommendations() async {
    final conversationId = state.conversationId;
    if (conversationId == null) return;
    final messages = state.messages
        .where(
          (item) =>
              item.role == 'assistant' &&
              item.result != null &&
              !item.isRefreshingRecommendations,
        )
        .toList(growable: false);
    if (messages.isEmpty) return;
    // Leave individual checks in flight alone; later checks supersede this merge.
    final snapshots = {
      for (final message in messages)
        message.id: (message: message, version: _beginRefresh(message)),
    };
    var results = <String, AiConsultationReplyEntity>{};
    try {
      final history = await _repository.getMessages(conversationId);
      results = {
        for (final message in history)
          if (message.role == 'assistant' &&
              message.result != null &&
              message.result!.clientMessageId.isNotEmpty)
            message.result!.clientMessageId: message.result!,
      };
    } catch (_) {
      // Keep local history and require a manual check after a failed fetch.
    }
    if (!mounted || state.conversationId != conversationId) return;
    state = state.copyWith(
      messages: state.messages
          .map((item) {
            final snapshot = snapshots[item.id];
            if (snapshot == null ||
                !_isRefreshCurrent(
                  snapshot.message,
                  conversationId,
                  snapshot.version,
                )) {
              return item;
            }
            final result = results[item.result!.clientMessageId];
            return item.copyWith(
              result: result,
              isRefreshingRecommendations: false,
              // The server returns only its latest 50 messages. Older local results
              // also need an individual check before their cards can be used.
              recommendationsRefreshFailed: result == null,
            );
          })
          .toList(growable: false),
      errorMessage: state.errorMessage,
    );
  }

  Future<void> recordAction(
    AiConsultationReplyEntity reply,
    String type, {
    String? targetId,
  }) async {
    final conversationId = state.conversationId;
    if (conversationId == null || reply.clientMessageId.isEmpty) return;
    try {
      await _repository.recordAction(
        conversationId: conversationId,
        clientMessageId: reply.clientMessageId,
        type: type,
        targetId: targetId,
      );
    } catch (_) {
      // Analytics must not interrupt navigation or booking.
    }
  }

  static String _message(Object error) {
    final value = error.toString();
    return value
        .replaceFirst('Exception: ', '')
        .replaceFirst('ServerFailure: ', '')
        .trim();
  }
}
