import 'package:equatable/equatable.dart';

import './chat_message_entity.dart';
import './chat_peer_entity.dart';

class ChatConversationEntity extends Equatable {
  final String id;
  final String providerId;
  final ChatPeerEntity peer;
  final ChatMessageEntity? lastMessage;
  final DateTime lastMessageAt;
  final int unreadCount;
  final bool blockedByMe;

  const ChatConversationEntity({
    required this.id,
    required this.providerId,
    required this.peer,
    this.lastMessage,
    required this.lastMessageAt,
    this.unreadCount = 0,
    this.blockedByMe = false,
  });

  bool get hasUnread => unreadCount > 0;

  factory ChatConversationEntity.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v) {
      if (v == null) return DateTime.now();
      return DateTime.tryParse(v.toString()) ?? DateTime.now();
    }

    final peerJson = json['peer'] as Map<String, dynamic>? ?? {};
    final lastMessageJson = json['lastMessage'] as Map<String, dynamic>?;

    return ChatConversationEntity(
      id: json['id']?.toString() ?? '',
      providerId: json['providerId']?.toString() ?? '',
      peer: ChatPeerEntity.fromJson(peerJson),
      lastMessage: lastMessageJson != null
          ? ChatMessageEntity.fromJson(lastMessageJson)
          : null,
      lastMessageAt: parseDate(json['lastMessageAt']),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      blockedByMe: json['blockedByMe'] == true,
    );
  }

  ChatConversationEntity copyWith({
    String? id,
    String? providerId,
    ChatPeerEntity? peer,
    ChatMessageEntity? lastMessage,
    DateTime? lastMessageAt,
    int? unreadCount,
    bool? blockedByMe,
  }) {
    return ChatConversationEntity(
      id: id ?? this.id,
      providerId: providerId ?? this.providerId,
      peer: peer ?? this.peer,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      blockedByMe: blockedByMe ?? this.blockedByMe,
    );
  }

  @override
  List<Object?> get props => [
    id,
    providerId,
    peer,
    lastMessage,
    lastMessageAt,
    unreadCount,
    blockedByMe,
  ];
}
