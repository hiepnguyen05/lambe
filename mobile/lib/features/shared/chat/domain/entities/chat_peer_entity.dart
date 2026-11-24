import 'package:equatable/equatable.dart';

class ChatPeerEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;

  const ChatPeerEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
  });

  factory ChatPeerEntity.fromJson(Map<String, dynamic> json) {
    return ChatPeerEntity(
      id: json['id']?.toString() ?? '',
      displayName:
          json['displayName']?.toString() ??
          json['fullName']?.toString() ??
          'Người dùng Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
    );
  }

  @override
  List<Object?> get props => [id, displayName, avatarUrl];
}
