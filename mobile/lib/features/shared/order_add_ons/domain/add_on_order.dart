import 'package:equatable/equatable.dart';

import 'order_add_on.dart';

class AddOnOrder extends Equatable {
  final String id, status, serviceName, currencyCode;
  final int servicePriceAmount, totalAmount, durationMinutes;
  final int? commissionAmount;
  final String? cancellationStatus;
  final DateTime updatedAt;
  final DateTime? expectedEndAt;
  final List<OrderAddOn> items;
  const AddOnOrder({
    required this.id,
    required this.status,
    required this.serviceName,
    required this.currencyCode,
    required this.servicePriceAmount,
    required this.totalAmount,
    required this.durationMinutes,
    required this.updatedAt,
    this.expectedEndAt,
    this.commissionAmount,
    this.cancellationStatus,
    this.items = const [],
  });
  bool get eligible =>
      const {'ARRIVED', 'IN_PROGRESS'}.contains(status) &&
      !const {
        'PENDING_CUSTOMER',
        'SUPPORT_REVIEW',
      }.contains(cancellationStatus);
  bool canPropose(DateTime now) =>
      eligible &&
      accepted.length < 5 &&
      !items.any((item) => item.pending(now));
  List<OrderAddOn> get accepted =>
      items.where((item) => item.status == 'ACCEPTED').toList(growable: false);
  OrderAddOn? item(String id) {
    for (final value in items) {
      if (value.id == id) return value;
    }
    return null;
  }

  DateTime get revision => items.fold(updatedAt, (date, item) {
    final latest = item.respondedAt ?? item.createdAt;
    return latest.isAfter(date) ? latest : date;
  });
  factory AddOnOrder.fromJson(Map<String, dynamic> json) => AddOnOrder(
    id: json['id'] as String,
    status: json['status'] as String,
    serviceName: json['serviceName'] as String,
    currencyCode: json['currencyCode'] as String,
    servicePriceAmount: addOnInteger(json['servicePriceAmount']),
    totalAmount: addOnInteger(json['totalAmount']),
    durationMinutes: addOnInteger(json['durationMinutes']),
    commissionAmount: json['commissionAmount'] == null
        ? null
        : addOnInteger(json['commissionAmount']),
    cancellationStatus:
        (json['cancellationRequest'] as Map?)?['status'] as String?,
    updatedAt: addOnDate(json['updatedAt']),
    expectedEndAt: json['expectedEndAt'] == null
        ? null
        : addOnDate(json['expectedEndAt']),
    items: (json['addOns'] as List)
        .map(
          (row) => OrderAddOn.fromJson(Map<String, dynamic>.from(row as Map)),
        )
        .toList(growable: false),
  );
  @override
  List<Object?> get props => [
    id,
    status,
    serviceName,
    currencyCode,
    servicePriceAmount,
    totalAmount,
    durationMinutes,
    commissionAmount,
    cancellationStatus,
    updatedAt,
    expectedEndAt,
    items,
  ];
}
