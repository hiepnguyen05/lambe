import 'package:equatable/equatable.dart';

enum ChatMessageKind { text, image, serviceCard, orderEvent }

class ChatImageAttachment extends Equatable {
  final String id;
  final String url;
  final String mimeType;
  final int byteSize;
  final int width;
  final int height;
  final int position;

  const ChatImageAttachment({
    required this.id,
    required this.url,
    required this.mimeType,
    required this.byteSize,
    required this.width,
    required this.height,
    required this.position,
  });

  factory ChatImageAttachment.fromJson(Map<String, dynamic> json) {
    return ChatImageAttachment(
      id: json['id']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? 'image/jpeg',
      byteSize: (json['byteSize'] as num?)?.toInt() ?? 0,
      width: (json['width'] as num?)?.toInt() ?? 0,
      height: (json['height'] as num?)?.toInt() ?? 0,
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [
    id,
    url,
    mimeType,
    byteSize,
    width,
    height,
    position,
  ];
}

class ChatServiceCardPayload extends Equatable {
  final String serviceName;
  final int priceAmount;
  final String currencyCode;
  final int durationMinutes;

  const ChatServiceCardPayload({
    required this.serviceName,
    required this.priceAmount,
    this.currencyCode = 'VND',
    required this.durationMinutes,
  });

  factory ChatServiceCardPayload.fromJson(Map<String, dynamic> json) {
    return ChatServiceCardPayload(
      serviceName: json['serviceName']?.toString() ?? 'Dịch vụ',
      priceAmount: (json['priceAmount'] as num?)?.toInt() ?? 0,
      currencyCode: json['currencyCode']?.toString() ?? 'VND',
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 30,
    );
  }

  @override
  List<Object?> get props => [
    serviceName,
    priceAmount,
    currencyCode,
    durationMinutes,
  ];
}

class ChatOrderEventPayload extends Equatable {
  final String event;
  final String? orderId;

  const ChatOrderEventPayload({required this.event, this.orderId});

  factory ChatOrderEventPayload.fromJson(
    Map<String, dynamic> json, {
    String? orderId,
  }) {
    return ChatOrderEventPayload(
      event: json['event']?.toString() ?? 'ORDER_REQUESTED',
      orderId: orderId ?? json['orderId']?.toString(),
    );
  }

  @override
  List<Object?> get props => [event, orderId];
}

class ChatMessageEntity extends Equatable {
  final String id;
  final int sequence;
  final String? senderUserId;
  final ChatMessageKind kind;
  final String? text;
  final String? providerServiceId;
  final String? orderId;
  final dynamic payload;
  final List<ChatImageAttachment> attachments;
  final DateTime createdAt;
  final String? clientMessageId;
  final bool isSending;
  final bool hasError;

  const ChatMessageEntity({
    required this.id,
    required this.sequence,
    this.senderUserId,
    required this.kind,
    this.text,
    this.providerServiceId,
    this.orderId,
    this.payload,
    this.attachments = const [],
    required this.createdAt,
    this.clientMessageId,
    this.isSending = false,
    this.hasError = false,
  });

  bool isMine(String currentUserId) => senderUserId == currentUserId;
  bool get isSystem => senderUserId == null;

  ChatServiceCardPayload? get serviceCardPayload {
    if (kind == ChatMessageKind.serviceCard &&
        payload is Map<String, dynamic>) {
      return ChatServiceCardPayload.fromJson(payload as Map<String, dynamic>);
    }
    return null;
  }

  ChatOrderEventPayload? get orderEventPayload {
    if (kind == ChatMessageKind.orderEvent) {
      if (payload is Map<String, dynamic>) {
        return ChatOrderEventPayload.fromJson(
          payload as Map<String, dynamic>,
          orderId: orderId,
        );
      }
      return ChatOrderEventPayload(event: 'ORDER_REQUESTED', orderId: orderId);
    }
    return null;
  }

  factory ChatMessageEntity.fromJson(Map<String, dynamic> json) {
    ChatMessageKind parseKind(String? raw) {
      switch (raw) {
        case 'SERVICE_CARD':
          return ChatMessageKind.serviceCard;
        case 'IMAGE':
          return ChatMessageKind.image;
        case 'ORDER_EVENT':
          return ChatMessageKind.orderEvent;
        case 'TEXT':
        default:
          return ChatMessageKind.text;
      }
    }

    DateTime parseDate(dynamic v) {
      if (v == null) return DateTime.now();
      return DateTime.tryParse(v.toString()) ?? DateTime.now();
    }

    return ChatMessageEntity(
      id: json['id']?.toString() ?? '',
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      senderUserId: json['senderUserId']?.toString(),
      kind: parseKind(json['kind']?.toString()),
      text: json['text']?.toString(),
      providerServiceId: json['providerServiceId']?.toString(),
      orderId: json['orderId']?.toString(),
      payload: json['payload'],
      attachments:
          (json['attachments'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(ChatImageAttachment.fromJson)
              .toList()
            ..sort((a, b) => a.position.compareTo(b.position)),
      createdAt: parseDate(json['createdAt']),
      clientMessageId: json['clientMessageId']?.toString(),
    );
  }

  ChatMessageEntity copyWith({
    String? id,
    int? sequence,
    String? senderUserId,
    ChatMessageKind? kind,
    String? text,
    String? providerServiceId,
    String? orderId,
    dynamic payload,
    List<ChatImageAttachment>? attachments,
    DateTime? createdAt,
    String? clientMessageId,
    bool? isSending,
    bool? hasError,
  }) {
    return ChatMessageEntity(
      id: id ?? this.id,
      sequence: sequence ?? this.sequence,
      senderUserId: senderUserId ?? this.senderUserId,
      kind: kind ?? this.kind,
      text: text ?? this.text,
      providerServiceId: providerServiceId ?? this.providerServiceId,
      orderId: orderId ?? this.orderId,
      payload: payload ?? this.payload,
      attachments: attachments ?? this.attachments,
      createdAt: createdAt ?? this.createdAt,
      clientMessageId: clientMessageId ?? this.clientMessageId,
      isSending: isSending ?? this.isSending,
      hasError: hasError ?? this.hasError,
    );
  }

  @override
  List<Object?> get props => [
    id,
    sequence,
    senderUserId,
    kind,
    text,
    providerServiceId,
    orderId,
    payload,
    attachments,
    createdAt,
    clientMessageId,
    isSending,
    hasError,
  ];
}
