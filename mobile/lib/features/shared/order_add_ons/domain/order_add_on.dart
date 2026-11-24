import 'package:equatable/equatable.dart';

enum AddOnRole { customer, provider }

class AddOnScope extends Equatable {
  final String orderId;
  final AddOnRole role;
  const AddOnScope(this.orderId, this.role);
  String get path => role == AddOnRole.customer
      ? '/me/orders/$orderId'
      : '/me/provider/orders/$orderId';
  @override
  List<Object?> get props => [orderId, role];
}

int addOnInteger(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Số tiền hoặc thời lượng không hợp lệ.');
  }
  return value;
}

DateTime addOnDate(Object? value) {
  final text = value?.toString() ?? '';
  if (!RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(text)) {
    throw const FormatException('Thiếu múi giờ.');
  }
  return DateTime.parse(text).toUtc();
}

class OrderAddOn extends Equatable {
  final String id, providerServiceId, serviceName, status;
  final int priceAmount, durationMinutes, commissionAmount, proposedTotalAmount;
  final DateTime proposedEndAt, expiresAt, createdAt;
  final DateTime? respondedAt, confirmedEndAt;
  final String? note;
  const OrderAddOn({
    required this.id,
    required this.providerServiceId,
    required this.serviceName,
    required this.status,
    required this.priceAmount,
    required this.durationMinutes,
    required this.commissionAmount,
    required this.proposedTotalAmount,
    required this.proposedEndAt,
    required this.expiresAt,
    required this.createdAt,
    this.respondedAt,
    this.confirmedEndAt,
    this.note,
  });
  bool pending(DateTime now) => status == 'PENDING' && expiresAt.isAfter(now);
  factory OrderAddOn.fromJson(Map<String, dynamic> json) {
    if (!const {
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
    }.contains(json['status'])) {
      throw const FormatException('Trạng thái dịch vụ phát sinh không hợp lệ.');
    }
    return OrderAddOn(
      id: json['id'] as String,
      providerServiceId: json['providerServiceId'] as String,
      serviceName: json['serviceName'] as String,
      status: json['status'] as String,
      priceAmount: addOnInteger(json['priceAmount']),
      durationMinutes: addOnInteger(json['durationMinutes']),
      commissionAmount: addOnInteger(json['commissionAmount']),
      proposedTotalAmount: addOnInteger(json['proposedTotalAmount']),
      proposedEndAt: addOnDate(json['proposedEndAt']),
      expiresAt: addOnDate(json['expiresAt']),
      createdAt: addOnDate(json['createdAt']),
      respondedAt: json['respondedAt'] == null
          ? null
          : addOnDate(json['respondedAt']),
      confirmedEndAt: json['confirmedEndAt'] == null
          ? null
          : addOnDate(json['confirmedEndAt']),
      note: json['note'] as String?,
    );
  }
  @override
  List<Object?> get props => [
    id,
    providerServiceId,
    serviceName,
    status,
    priceAmount,
    durationMinutes,
    commissionAmount,
    proposedTotalAmount,
    proposedEndAt,
    expiresAt,
    createdAt,
    respondedAt,
    confirmedEndAt,
    note,
  ];
}

class AddOnOption {
  final String providerServiceId, serviceName;
  final int priceAmount, durationMinutes, commissionAmount, proposedTotalAmount;
  final DateTime proposedEndAt;
  final bool available;
  final String? reason;
  const AddOnOption({
    required this.providerServiceId,
    required this.serviceName,
    required this.priceAmount,
    required this.durationMinutes,
    required this.commissionAmount,
    required this.proposedTotalAmount,
    required this.proposedEndAt,
    required this.available,
    this.reason,
  });
  factory AddOnOption.fromJson(Map<String, dynamic> json) => AddOnOption(
    providerServiceId: json['providerServiceId'] as String,
    serviceName: json['serviceName'] as String,
    priceAmount: addOnInteger(json['priceAmount']),
    durationMinutes: addOnInteger(json['durationMinutes']),
    commissionAmount: addOnInteger(json['commissionAmount']),
    proposedTotalAmount: addOnInteger(json['proposedTotalAmount']),
    proposedEndAt: addOnDate(json['proposedEndAt']),
    available: json['available'] as bool,
    reason: json['reason'] as String?,
  );
}
