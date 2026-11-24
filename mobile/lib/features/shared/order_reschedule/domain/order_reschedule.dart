import 'package:equatable/equatable.dart';

enum RescheduleRole { customer, provider }

class RescheduleScope extends Equatable {
  final String orderId;
  final RescheduleRole role;
  const RescheduleScope(this.orderId, this.role);
  String get orderPath => role == RescheduleRole.customer
      ? '/me/orders/$orderId'
      : '/me/provider/orders/$orderId';
  @override
  List<Object?> get props => [orderId, role];
}

class RescheduleProposal extends Equatable {
  final String id;
  final String status;
  final DateTime startAt;
  final DateTime endAt;
  final DateTime expiresAt;
  final DateTime createdAt;
  final DateTime? respondedAt;
  const RescheduleProposal({
    required this.id,
    required this.status,
    required this.startAt,
    required this.endAt,
    required this.expiresAt,
    required this.createdAt,
    this.respondedAt,
  });
  bool isPending(DateTime now) => status == 'PENDING' && expiresAt.isAfter(now);
  String label(DateTime now) => switch (status) {
    'ACCEPTED' => 'Đã chấp nhận giờ mới',
    'REJECTED' => 'Yêu cầu đã từ chối hoặc hết hiệu lực',
    _ => isPending(now) ? 'Đang chờ thợ phản hồi' : 'Yêu cầu đã hết hạn',
  };
  factory RescheduleProposal.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        !const {'PENDING', 'ACCEPTED', 'REJECTED'}.contains(json['status'])) {
      throw const FormatException('Yêu cầu đổi lịch không hợp lệ.');
    }
    return RescheduleProposal(
      id: json['id'] as String,
      status: json['status'] as String,
      startAt: instant(json['proposedStartAt']),
      endAt: instant(json['proposedEndAt']),
      expiresAt: instant(json['expiresAt']),
      createdAt: instant(json['createdAt']),
      respondedAt: json['respondedAt'] == null
          ? null
          : instant(json['respondedAt']),
    );
  }
  @override
  List<Object?> get props => [
    id,
    status,
    startAt,
    endAt,
    expiresAt,
    createdAt,
    respondedAt,
  ];
}

class RescheduleOrder extends Equatable {
  final String id;
  final String status;
  final String bookingType;
  final DateTime? startAt;
  final DateTime? updatedAt;
  final RescheduleProposal? proposal;
  const RescheduleOrder({
    required this.id,
    required this.status,
    required this.bookingType,
    this.startAt,
    this.updatedAt,
    this.proposal,
  });
  bool get eligible => status == 'ACCEPTED' && bookingType == 'SCHEDULED';
  DateTime get revision {
    var value =
        updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    for (final date in [proposal?.createdAt, proposal?.respondedAt]) {
      if (date != null && date.isAfter(value)) value = date;
    }
    return value;
  }

  factory RescheduleOrder.fromJson(
    Map<String, dynamic> json,
  ) => RescheduleOrder(
    id: json['id'] as String,
    status: json['status'] as String,
    bookingType: json['bookingType'] as String,
    startAt: json['scheduledAt'] == null ? null : instant(json['scheduledAt']),
    updatedAt: json['updatedAt'] == null ? null : instant(json['updatedAt']),
    proposal: json['rescheduleRequest'] == null
        ? null
        : RescheduleProposal.fromJson(
            Map<String, dynamic>.from(json['rescheduleRequest'] as Map),
          ),
  );
  @override
  List<Object?> get props => [
    id,
    status,
    bookingType,
    startAt,
    updatedAt,
    proposal,
  ];
}

DateTime instant(Object? value) {
  final text = value?.toString() ?? '';
  if (!RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(text)) {
    throw const FormatException('Thời gian máy chủ thiếu múi giờ.');
  }
  return DateTime.parse(text).toUtc();
}

/// Wall-clock date fields for the Vietnam service area, independent of device timezone.
DateTime vietnamWallTime(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 7));
DateTime fromVietnamWallTime(DateTime date, int hour, int minute) =>
    DateTime.utc(
      date.year,
      date.month,
      date.day,
      hour,
      minute,
    ).subtract(const Duration(hours: 7));
String? validateRescheduleTime(DateTime time, DateTime now, DateTime? current) {
  final lead = time.difference(now);
  if (lead < const Duration(hours: 1)) {
    return 'Chọn giờ cách hiện tại ít nhất 60 phút.';
  }
  if (lead > const Duration(days: 30)) {
    return 'Chỉ được đổi sang giờ trong 30 ngày tới.';
  }
  if (current != null && time.isAtSameMomentAs(current)) {
    return 'Giờ mới trùng với lịch hiện tại.';
  }
  return null;
}
