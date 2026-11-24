import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/chat_remote_datasource.dart';
import '../domain/entities/chat_conversation_entity.dart';

class ChatInboxState {
  final List<ChatConversationEntity> conversations;
  final bool isLoading;
  final bool isLoadingMore;
  final String? nextCursor;
  final String? errorMessage;

  const ChatInboxState({
    this.conversations = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.nextCursor,
    this.errorMessage,
  });

  int get totalUnreadCount =>
      conversations.fold(0, (sum, c) => sum + c.unreadCount);

  ChatInboxState copyWith({
    List<ChatConversationEntity>? conversations,
    bool? isLoading,
    bool? isLoadingMore,
    String? nextCursor,
    String? errorMessage,
  }) {
    return ChatInboxState(
      conversations: conversations ?? this.conversations,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      nextCursor: nextCursor,
      errorMessage: errorMessage,
    );
  }
}

class ChatInboxNotifier extends StateNotifier<ChatInboxState> {
  final ChatRemoteDataSource _dataSource;
  final String _view; // 'customer' | 'provider'

  ChatInboxNotifier(this._dataSource, this._view)
    : super(const ChatInboxState()) {
    fetchInbox();
  }

  Future<void> fetchInbox({bool silent = false}) async {
    if (!silent) {
      state = state.copyWith(isLoading: true, errorMessage: null);
    }
    try {
      final res = await _dataSource.getInbox(view: _view, limit: 20);
      if (!mounted) return;
      state = state.copyWith(
        conversations: res.conversations,
        nextCursor: res.nextCursor,
        isLoading: false,
        errorMessage: null,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> refresh() => fetchInbox();

  Future<void> loadMoreConversations() => fetchMore();

  Future<void> fetchMore() async {
    if (state.isLoadingMore || state.nextCursor == null) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final res = await _dataSource.getInbox(
        view: _view,
        cursor: state.nextCursor,
        limit: 20,
      );
      if (!mounted) return;
      state = state.copyWith(
        conversations: [...state.conversations, ...res.conversations],
        nextCursor: res.nextCursor,
        isLoadingMore: false,
      );
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void markConversationReadLocally(String conversationId, int lastSequence) {
    state = state.copyWith(
      conversations: state.conversations.map((c) {
        if (c.id == conversationId) {
          return c.copyWith(unreadCount: 0);
        }
        return c;
      }).toList(),
    );
  }

  void updateBlockedLocally(String conversationId, bool blocked) {
    state = state.copyWith(
      conversations: state.conversations.map((c) {
        if (c.id == conversationId) {
          return c.copyWith(blockedByMe: blocked);
        }
        return c;
      }).toList(),
    );
  }
}
