import 'package:equatable/equatable.dart';

class WorkerCollectionSummaryEntity extends Equatable {
  final int completedOrderCount;
  final int customerPayableAmount;
  final int cashRecordedAmount;
  final int cashRecordedOrderCount;
  final int cashUnverifiedOrderCount;
  final int cashUnverifiedPayableAmount;
  final String collectionPurpose;

  const WorkerCollectionSummaryEntity({
    required this.completedOrderCount,
    required this.customerPayableAmount,
    required this.cashRecordedAmount,
    required this.cashRecordedOrderCount,
    required this.cashUnverifiedOrderCount,
    required this.cashUnverifiedPayableAmount,
    required this.collectionPurpose,
  });

  factory WorkerCollectionSummaryEntity.fromJson(Map<String, dynamic> json) {
    return WorkerCollectionSummaryEntity(
      completedOrderCount:
          (json['completedOrderCount'] as num?)?.toInt() ?? 0,
      customerPayableAmount:
          (json['customerPayableAmount'] as num?)?.toInt() ?? 0,
      cashRecordedAmount:
          (json['cashRecordedAmount'] as num?)?.toInt() ?? 0,
      cashRecordedOrderCount:
          (json['cashRecordedOrderCount'] as num?)?.toInt() ?? 0,
      cashUnverifiedOrderCount:
          (json['cashUnverifiedOrderCount'] as num?)?.toInt() ?? 0,
      cashUnverifiedPayableAmount:
          (json['cashUnverifiedPayableAmount'] as num?)?.toInt() ?? 0,
      collectionPurpose:
          json['collectionPurpose']?.toString() ?? 'ON_BEHALF_OF_ORGANIZATION',
    );
  }

  @override
  List<Object?> get props => [
    completedOrderCount,
    customerPayableAmount,
    cashRecordedAmount,
    cashRecordedOrderCount,
    cashUnverifiedOrderCount,
    cashUnverifiedPayableAmount,
    collectionPurpose,
  ];
}

class WorkerCollectionOrderItemEntity extends Equatable {
  final String orderId;
  final String orderCode;
  final int customerPayableAmount;
  final String? cashCollectionStatus; // RECORDED, UNVERIFIED
  final int? cashCollectedAmount;
  final DateTime? completedAt;

  const WorkerCollectionOrderItemEntity({
    required this.orderId,
    required this.orderCode,
    required this.customerPayableAmount,
    this.cashCollectionStatus,
    this.cashCollectedAmount,
    this.completedAt,
  });

  factory WorkerCollectionOrderItemEntity.fromJson(Map<String, dynamic> json) {
    final cashMap = json['cashCollection'] is Map
        ? Map<String, dynamic>.from(json['cashCollection'] as Map)
        : null;
    return WorkerCollectionOrderItemEntity(
      orderId: json['orderId']?.toString() ?? '',
      orderCode: json['orderCode']?.toString() ?? (json['orderId']?.toString().substring(0, 8).toUpperCase() ?? ''),
      customerPayableAmount:
          (json['customerPayableAmount'] as num?)?.toInt() ?? 0,
      cashCollectionStatus: cashMap?['status']?.toString() ?? json['cashCollectionStatus']?.toString(),
      cashCollectedAmount: (cashMap?['amount'] as num?)?.toInt() ?? (json['cashCollectedAmount'] as num?)?.toInt(),
      completedAt: DateTime.tryParse(json['completedAt']?.toString() ?? ''),
    );
  }

  @override
  List<Object?> get props => [
    orderId,
    orderCode,
    customerPayableAmount,
    cashCollectionStatus,
    cashCollectedAmount,
    completedAt,
  ];
}

