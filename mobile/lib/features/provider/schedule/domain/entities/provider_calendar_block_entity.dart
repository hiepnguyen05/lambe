import 'package:equatable/equatable.dart';

class ProviderCalendarOrderEntity extends Equatable {
  final String status;
  final String bookingType;
  final DateTime? expectedStartAt;
  final DateTime? expectedEndAt;
  final String? serviceName;

  const ProviderCalendarOrderEntity({
    required this.status,
    required this.bookingType,
    this.expectedStartAt,
    this.expectedEndAt,
    this.serviceName,
  });

  factory ProviderCalendarOrderEntity.fromJson(Map<String, dynamic> json) {
    return ProviderCalendarOrderEntity(
      status: json['status']?.toString() ?? '',
      bookingType: json['bookingType']?.toString() ?? '',
      expectedStartAt: json['expectedStartAt'] != null
          ? DateTime.tryParse(json['expectedStartAt'].toString())?.toLocal()
          : null,
      expectedEndAt: json['expectedEndAt'] != null
          ? DateTime.tryParse(json['expectedEndAt'].toString())?.toLocal()
          : null,
      serviceName: json['serviceName']?.toString(),
    );
  }

  @override
  List<Object?> get props => [
    status,
    bookingType,
    expectedStartAt,
    expectedEndAt,
    serviceName,
  ];
}

class ProviderCalendarBlockEntity extends Equatable {
  final String id;
  final String? orderId;
  final DateTime startAt;
  final DateTime endAt;
  final DateTime? holdExpiresAt;
  final String? reason;
  final ProviderCalendarOrderEntity? order;

  const ProviderCalendarBlockEntity({
    required this.id,
    this.orderId,
    required this.startAt,
    required this.endAt,
    this.holdExpiresAt,
    this.reason,
    this.order,
  });

  bool get isTimeOff => orderId == null;
  bool get isAppointment => orderId != null;

  String get durationFormatted {
    final diff = endAt.difference(startAt);
    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return '${hours}h ${minutes}p';
    } else if (hours > 0) {
      return '${hours}h';
    }
    return '${minutes}p';
  }

  String get timeRangeFormatted {
    final startH = startAt.hour.toString().padLeft(2, '0');
    final startM = startAt.minute.toString().padLeft(2, '0');
    final endH = endAt.hour.toString().padLeft(2, '0');
    final endM = endAt.minute.toString().padLeft(2, '0');
    return '$startH:$startM - $endH:$endM';
  }

  factory ProviderCalendarBlockEntity.fromJson(Map<String, dynamic> json) {
    return ProviderCalendarBlockEntity(
      id: json['id']?.toString() ?? '',
      orderId: json['orderId']?.toString(),
      startAt: DateTime.parse(json['startAt'].toString()).toLocal(),
      endAt: DateTime.parse(json['endAt'].toString()).toLocal(),
      holdExpiresAt: json['holdExpiresAt'] != null
          ? DateTime.tryParse(json['holdExpiresAt'].toString())?.toLocal()
          : null,
      reason: json['reason']?.toString(),
      order: json['order'] != null && json['order'] is Map<String, dynamic>
          ? ProviderCalendarOrderEntity.fromJson(
              json['order'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  @override
  List<Object?> get props => [
    id,
    orderId,
    startAt,
    endAt,
    holdExpiresAt,
    reason,
    order,
  ];
}
