import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import 'package:mobile/core/utils/uuid_utils.dart';
import 'package:mobile/core/network/upload_payload.dart';

import '../data/datasources/chat_remote_datasource.dart';
import '../data/datasources/chat_events_source.dart';
import '../domain/entities/chat_message_entity.dart';
import '../domain/entities/chat_peer_entity.dart';
import 'chat_attachment_service.dart';

class ChatRoomState {
  static const _unchangedCursor = Object();
  final String? conversationId;
  final String? providerId;
  final ChatPeerEntity? peer;
  final List<ChatMessageEntity> messages;
  final bool isLoading;
  final bool isLoadingOlder;
  final int? olderSequenceCursor;
  final bool isSending;
  final String? errorMessage;
  final bool isBlocked;
  final int lastReadSequence;

  const ChatRoomState({
    this.conversationId,
    this.providerId,
    this.peer,
    this.messages = const [],
    this.isLoading = false,
    this.isLoadingOlder = false,
    this.olderSequenceCursor,
    this.isSending = false,
    this.errorMessage,
    this.isBlocked = false,
    this.lastReadSequence = 0,
  });

  int get highestSequence {
    final persisted = messages.where((m) => !m.id.startsWith('pending:'));
    if (persisted.isEmpty) return 0;
    return persisted.map((m) => m.sequence).reduce((a, b) => a > b ? a : b);
  }

  ChatRoomState copyWith({
    String? conversationId,
    String? providerId,
    ChatPeerEntity? peer,
    List<ChatMessageEntity>? messages,
    bool? isLoading,
    bool? isLoadingOlder,
    Object? olderSequenceCursor = _unchangedCursor,
    bool? isSending,
    String? errorMessage,
    bool? isBlocked,
    int? lastReadSequence,
  }) {
    return ChatRoomState(
      conversationId: conversationId ?? this.conversationId,
      providerId: providerId ?? this.providerId,
      peer: peer ?? this.peer,
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isLoadingOlder: isLoadingOlder ?? this.isLoadingOlder,
      olderSequenceCursor: identical(olderSequenceCursor, _unchangedCursor)
          ? this.olderSequenceCursor
          : olderSequenceCursor as int?,
      isSending: isSending ?? this.isSending,
      errorMessage: errorMessage,
      isBlocked: isBlocked ?? this.isBlocked,
      lastReadSequence: lastReadSequence ?? this.lastReadSequence,
    );
  }
}

class ChatRoomNotifier extends StateNotifier<ChatRoomState> {
  // Includes the active upload; evicted failures stay visible without bytes.
  static const maxRetainedImageMessages = 3;
  static const maxRetainedImageBytes = 20 * 1024 * 1024;
  final _pendingImages = <String, List<UploadPayload>>{};
  final ChatRemoteDataSource _dataSource;
  final ChatEventsSource? eventsSource;
  Timer? _pollingTimer;
  CancelToken? _eventsCancel;
  Future<void>? _eventsTask;
  bool _isSyncing = false;

  ChatRoomNotifier(
    this._dataSource, {
    this.eventsSource,
    String? conversationId,
    String? providerId,
    ChatPeerEntity? peer,
  }) : super(
         ChatRoomState(
           conversationId: conversationId,
           providerId: providerId,
           peer: peer,
         ),
       ) {
    if (conversationId != null) {
      loadInitialMessages();
    }
  }

  @override
  void dispose() {
    stopPolling();
    _eventsCancel?.cancel();
    _pendingImages.clear();
    super.dispose();
  }

  void _startEvents() {
    final conversationId = state.conversationId;
    if (conversationId == null) return;
    if (eventsSource == null) {
      startPolling();
      return;
    }
    if (_eventsTask != null && _eventsCancel?.isCancelled == false) return;
    final cancelToken = CancelToken();
    _eventsCancel = cancelToken;
    _eventsTask = _listenEvents(conversationId, cancelToken).whenComplete(() {
      if (identical(_eventsCancel, cancelToken)) {
        _eventsTask = null;
        _eventsCancel = null;
      }
    });
  }

  void pauseUpdates() {
    stopPolling();
    _eventsCancel?.cancel();
  }

  void resumeUpdates() {
    if (state.isLoading) return;
    _startEvents();
    unawaited(syncNewerMessages());
  }

  Future<void> _listenEvents(String conversationId, CancelToken cancel) async {
    var failures = 0;
    while (mounted && !cancel.isCancelled) {
      try {
        await for (final message in eventsSource!.watch(
          conversationId: conversationId,
          afterSequence: state.highestSequence,
          cancelToken: cancel,
          onConnected: () {
            if (mounted) stopPolling();
            failures = 0;
          },
        )) {
          if (!mounted || cancel.isCancelled) return;
          _mergeMessages([message]);
        }
      } catch (error) {
        if (kDebugMode && !cancel.isCancelled) {
          debugPrint('[ChatEvents] Kết nối gián đoạn: $error');
        }
      }
      if (!mounted || cancel.isCancelled) return;
      startPolling();
      await syncNewerMessages();
      failures = (failures + 1).clamp(1, 4);
      await Future<void>.delayed(Duration(seconds: 1 << (failures - 1)));
    }
  }

  void _mergeMessages(List<ChatMessageEntity> incoming) {
    if (incoming.isEmpty) return;
    final known = <String, ChatMessageEntity>{
      for (final message in state.messages) message.id: message,
    };
    var changed = false;
    for (final item in incoming) {
      // Later responses/events may omit the idempotency key.
      final message = item.clientMessageId == null
          ? item.copyWith(clientMessageId: known[item.id]?.clientMessageId)
          : item;
      if (message.clientMessageId != null) {
        _pendingImages.remove(message.clientMessageId);
        known.removeWhere((id, existing) {
          final duplicate =
              id != message.id &&
              existing.clientMessageId == message.clientMessageId;
          if (duplicate) changed = true;
          return duplicate;
        });
      }
      if (known[message.id] != message) changed = true;
      known[message.id] = message;
    }
    if (!changed) return;
    final sorted = known.values.toList()
      ..sort((a, b) => a.sequence.compareTo(b.sequence));
    state = state.copyWith(messages: sorted);
  }

  void startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      unawaited(_pollIfAvailable());
    });
  }

  Future<void> _pollIfAvailable() async {
    if (state.conversationId == null ||
        state.isLoading ||
        state.isSending ||
        _isSyncing) {
      return;
    }
    await syncNewerMessages();
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  Future<void> loadInitialMessages() async {
    final convId = state.conversationId;
    if (convId == null) return;

    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _dataSource.getMessages(
        conversationId: convId,
        limit: 50,
      );
      if (!mounted) return;

      _mergeMessages(res.messages);
      state = state.copyWith(
        olderSequenceCursor: res.nextCursor,
        isLoading: false,
      );

      _startEvents();
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> loadOlderMessages() async {
    final convId = state.conversationId;
    final cursor = state.olderSequenceCursor;
    if (convId == null || cursor == null || state.isLoadingOlder) return;

    state = state.copyWith(isLoadingOlder: true);
    try {
      final res = await _dataSource.getMessages(
        conversationId: convId,
        beforeSequence: cursor,
        limit: 50,
      );
      if (!mounted) return;

      _mergeMessages(res.messages);
      state = state.copyWith(
        olderSequenceCursor: res.nextCursor,
        isLoadingOlder: false,
      );
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(isLoadingOlder: false);
    }
  }

  Future<void> syncNewerMessages() async {
    final convId = state.conversationId;
    if (convId == null || _isSyncing) return;

    _isSyncing = true;
    final currentHighest = state.highestSequence;
    try {
      final res = await _dataSource.getMessages(
        conversationId: convId,
        afterSequence: currentHighest,
        limit: 100,
      );
      if (!mounted) return;

      if (res.messages.isNotEmpty) {
        _mergeMessages(res.messages);
      }
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('[ChatPolling] Không thể đồng bộ tin nhắn: $error');
        debugPrintStack(stackTrace: stackTrace);
      }
    } finally {
      _isSyncing = false;
    }
  }

  bool get _canSend => mounted && !state.isSending;

  Future<bool> sendTextMessage(String text) {
    final trimmed = text.trim();
    if (!_canSend || trimmed.isEmpty) return Future.value(false);
    return _send(_newPending(ChatMessageKind.text, text: trimmed));
  }

  Future<bool> sendServiceCard(String providerServiceId) {
    if (!_canSend ||
        state.conversationId == null ||
        providerServiceId.trim().isEmpty) {
      return Future.value(false);
    }
    return _send(
      _newPending(
        ChatMessageKind.serviceCard,
        providerServiceId: providerServiceId,
      ),
    );
  }

  List<UploadPayload> pendingImagesFor(ChatMessageEntity message) =>
      _pendingImages[message.clientMessageId] ?? const [];

  @visibleForTesting
  int get retainedImageBytes => _pendingImages.values.fold(
    0,
    (total, images) =>
        total + images.fold(0, (sum, image) => sum + image.bytes.length),
  );

  Future<bool> sendImages(List<UploadPayload> images) {
    if (!_canSend ||
        state.conversationId == null ||
        images.isEmpty ||
        images.length > ChatAttachmentService.maxAttachments ||
        images.any(
          (image) =>
              image.bytes.isEmpty ||
              image.bytes.length > ChatAttachmentService.maxFileSizeInBytes,
        )) {
      return Future.value(false);
    }
    final pending = _newPending(ChatMessageKind.image);
    final byteSize = images.fold(0, (sum, image) => sum + image.bytes.length);
    while (_pendingImages.isNotEmpty &&
        (_pendingImages.length >= maxRetainedImageMessages ||
            retainedImageBytes + byteSize > maxRetainedImageBytes)) {
      _pendingImages.remove(_pendingImages.keys.first);
    }
    // Own a stable snapshot: callers can reuse or mutate their selection.
    _pendingImages[pending.clientMessageId!] = List.unmodifiable([
      for (final image in images)
        UploadPayload(
          bytes: Uint8List.fromList(image.bytes).asUnmodifiableView(),
          fileName: image.fileName,
        ),
    ]);
    return _send(pending);
  }

  ChatMessageEntity _newPending(
    ChatMessageKind kind, {
    String? text,
    String? providerServiceId,
  }) {
    final clientMessageId = UuidUtils.generateV4();
    return ChatMessageEntity(
      id: 'pending:$clientMessageId',
      sequence: state.highestSequence + 1,
      kind: kind,
      text: text,
      providerServiceId: providerServiceId,
      clientMessageId: clientMessageId,
      createdAt: DateTime.now(),
      isSending: true,
    );
  }

  ChatMessageEntity? _retryableMessage(ChatMessageEntity failed) {
    if (!mounted || failed.clientMessageId == null) return null;
    for (final current in state.messages) {
      if (current.id != failed.id ||
          current.clientMessageId != failed.clientMessageId ||
          !current.id.startsWith('pending:') ||
          !current.hasError ||
          current.isSending) {
        continue;
      }
      return switch (current.kind) {
        ChatMessageKind.text => current.text == null ? null : current,
        ChatMessageKind.serviceCard =>
          current.providerServiceId == null ? null : current,
        ChatMessageKind.image =>
          _pendingImages.containsKey(current.clientMessageId) ? current : null,
        ChatMessageKind.orderEvent => null,
      };
    }
    return null;
  }

  bool canRetryMessage(ChatMessageEntity failed) =>
      _canSend && _retryableMessage(failed) != null;

  Future<bool> retryMessage(ChatMessageEntity failed) {
    if (!_canSend) return Future.value(false);
    final current = _retryableMessage(failed);
    if (current == null) return Future.value(false);
    return _send(current.copyWith(isSending: true, hasError: false));
  }

  Future<bool> retryTextMessage(ChatMessageEntity failed) =>
      failed.kind == ChatMessageKind.text
      ? retryMessage(failed)
      : Future.value(false);

  Future<bool> _send(ChatMessageEntity pending) async {
    if (!_canSend ||
        (state.conversationId == null &&
            (pending.kind != ChatMessageKind.text ||
                state.providerId == null))) {
      return false;
    }
    final clientMessageId = pending.clientMessageId!;
    state = state.copyWith(
      isSending: true,
      messages: [
        for (final message in state.messages)
          if (message.id != pending.id) message,
        pending,
      ]..sort((a, b) => a.sequence.compareTo(b.sequence)),
    );
    try {
      ChatMessageEntity saved;
      if (state.conversationId == null) {
        final result = await _dataSource.startConversation(
          providerId: state.providerId!,
          text: pending.text!,
          clientMessageId: clientMessageId,
        );
        if (!mounted) return false;
        state = state.copyWith(conversationId: result.conversationId);
        saved = result.message;
        _startEvents();
      } else if (pending.kind == ChatMessageKind.image) {
        saved = await _dataSource.sendImages(
          conversationId: state.conversationId!,
          clientMessageId: clientMessageId,
          images: _pendingImages[clientMessageId]!,
        );
      } else {
        saved = await _dataSource.sendMessage(
          conversationId: state.conversationId!,
          clientMessageId: clientMessageId,
          kind: pending.kind == ChatMessageKind.text ? 'TEXT' : 'SERVICE_CARD',
          text: pending.text,
          providerServiceId: pending.providerServiceId,
        );
      }
      if (!mounted) return false;
      _mergeMessages([
        saved.clientMessageId == null
            ? saved.copyWith(clientMessageId: clientMessageId)
            : saved,
      ]);
      state = state.copyWith(isSending: false);
      return true;
    } catch (error) {
      if (!mounted) return false;
      // SSE/polling is authoritative even if the HTTP acknowledgement fails.
      final delivered = state.messages.any(
        (m) => m.clientMessageId == clientMessageId && m.id != pending.id,
      );
      if (delivered) {
        _pendingImages.remove(clientMessageId);
        state = state.copyWith(isSending: false);
        return true;
      }
      state = state.copyWith(
        isSending: false,
        messages: [
          for (final message in state.messages)
            message.id == pending.id
                ? message.copyWith(isSending: false, hasError: true)
                : message,
        ],
        errorMessage: error.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  void markVisibleMessagesRead() {
    final convId = state.conversationId;
    final highest = state.highestSequence;
    if (convId == null || highest <= state.lastReadSequence) return;

    _dataSource
        .markRead(conversationId: convId, lastReadSequence: highest)
        .then((newRead) {
          if (!mounted) return;
          state = state.copyWith(lastReadSequence: newRead);
        })
        .catchError((_) {});
  }

  Future<bool> toggleBlock() async {
    final convId = state.conversationId;
    if (convId == null) return false;

    try {
      if (state.isBlocked) {
        final unblocked = await _dataSource.unblockConversation(
          conversationId: convId,
        );
        if (!mounted) return false;
        state = state.copyWith(isBlocked: !unblocked);
      } else {
        final blocked = await _dataSource.blockConversation(
          conversationId: convId,
        );
        if (!mounted) return false;
        state = state.copyWith(isBlocked: blocked);
      }
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> report({
    required String reason,
    String? messageId,
    String? detail,
  }) async {
    final convId = state.conversationId;
    if (convId == null) return false;

    try {
      await _dataSource.reportConversation(
        conversationId: convId,
        reason: reason,
        messageId: messageId,
        detail: detail,
      );
      if (!mounted) return false;
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }
}
