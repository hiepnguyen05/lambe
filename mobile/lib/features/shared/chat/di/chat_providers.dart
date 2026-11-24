import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';

import '../application/chat_inbox_notifier.dart';
import '../application/chat_room_notifier.dart';
import '../data/datasources/chat_remote_datasource.dart';
import '../data/datasources/chat_events_source.dart';
import '../domain/entities/chat_peer_entity.dart';

final chatRemoteDataSourceProvider = Provider<ChatRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return DioChatRemoteDataSource(dio);
});

final chatEventsSourceProvider = Provider<ChatEventsSource>((ref) {
  return DioChatEventsSource(ref.watch(dioProvider));
});

final chatInboxNotifierProvider = StateNotifierProvider.family
    .autoDispose<ChatInboxNotifier, ChatInboxState, String>((ref, view) {
      final ds = ref.watch(chatRemoteDataSourceProvider);
      return ChatInboxNotifier(ds, view);
    });

class ChatRoomParams extends Equatable {
  final String? conversationId;
  final String? providerId;
  final ChatPeerEntity? peer;

  const ChatRoomParams({this.conversationId, this.providerId, this.peer});

  @override
  List<Object?> get props => [conversationId, providerId, peer];
}

final chatRoomNotifierProvider = StateNotifierProvider.family
    .autoDispose<ChatRoomNotifier, ChatRoomState, ChatRoomParams>((
      ref,
      params,
    ) {
      final ds = ref.watch(chatRemoteDataSourceProvider);
      return ChatRoomNotifier(
        ds,
        eventsSource: ref.watch(chatEventsSourceProvider),
        conversationId: params.conversationId,
        providerId: params.providerId,
        peer: params.peer,
      );
    });
