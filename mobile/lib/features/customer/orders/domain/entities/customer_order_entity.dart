import 'package:equatable/equatable.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';

class CustomerOrderEntity extends Equatable {
  final String id;
  final String bookingType;
  final DateTime? scheduledAt;
  final String status;
  final String? rejectionReason;
  final String paymentMethod;
  final String serviceName;
  final int servicePriceAmount;
  final int travelFeeAmount;
  final double? travelDistanceKm;
  final int? subtotalAmount;
  final int discountAmount;
  final String? voucherCode;
  final String? voucherIssuer;
  final int totalAmount;
  final String currencyCode;
  final int durationMinutes;
  final DateTime? providerResponseDeadlineAt;
  final DateTime? expectedStartAt;
  final DateTime? expectedEndAt;
  final String? addressLabel;
  final String? addressLine;
  final String? addressNote;
  final double? addressLatitude;
  final double? addressLongitude;
  final String? contactName;
  final String? contactPhone;
  final String? customerNote;
  final OrderProviderSummaryEntity? provider;
  final List<OrderStatusHistoryEntity> statusHistory;
  final List<OrderEvidenceEntity> evidence;
  final OrderCancellationRequestEntity? cancellationRequest;
  final OrderReviewEntity? review;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final RescheduleProposal? rescheduleRequest;
  final AddOnOrder? addOnSnapshot;
  final PaymentDisputeOrder? paymentDispute;

  const CustomerOrderEntity({
    required this.id,
    required this.bookingType,
    this.scheduledAt,
    required this.status,
    this.rejectionReason,
    this.paymentMethod = 'CASH',
    required this.serviceName,
    required this.servicePriceAmount,
    this.travelFeeAmount = 0,
    this.travelDistanceKm,
    this.subtotalAmount,
    this.discountAmount = 0,
    this.voucherCode,
    this.voucherIssuer,
    required this.totalAmount,
    this.currencyCode = 'VND',
    this.durationMinutes = 60,
    this.providerResponseDeadlineAt,
    this.expectedStartAt,
    this.expectedEndAt,
    this.addressLabel,
    this.addressLine,
    this.addressNote,
    this.addressLatitude,
    this.addressLongitude,
    this.contactName,
    this.contactPhone,
    this.customerNote,
    this.provider,
    this.statusHistory = const [],
    this.evidence = const [],
    this.cancellationRequest,
    this.review,
    this.createdAt,
    this.updatedAt,
    this.rescheduleRequest,
    this.addOnSnapshot,
    this.paymentDispute,
  });

  bool get isPending => status == 'PENDING_PROVIDER';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isEnRoute => status == 'EN_ROUTE';
  bool get isArrived => status == 'ARRIVED';
  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isRejected => status == 'REJECTED';
  bool get isExpired => status == 'EXPIRED';

  bool get isActive => isAccepted || isEnRoute || isArrived || isInProgress;

  bool get isSafetyHold => status == 'SAFETY_HOLD';

  bool get isPaymentDispute => isPaymentDisputed(status);
  bool get needsSupport => isPaymentDispute || isSafetyHold;
  bool get canReview => isCompleted && review == null;
  bool get shouldPoll => isPending || isActive || needsSupport;

  bool get canCancel => isPending || isAccepted;

  RescheduleOrder get rescheduleSnapshot => RescheduleOrder(
    id: id,
    status: status,
    bookingType: bookingType,
    startAt: scheduledAt,
    updatedAt: updatedAt,
    proposal: rescheduleRequest,
  );

  factory CustomerOrderEntity.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic v) =>
        v != null ? DateTime.tryParse(v.toString())?.toLocal() : null;

    final historyList = (json['statusHistory'] as List<dynamic>?) ?? [];
    final evidenceList = (json['evidence'] as List<dynamic>?) ?? [];

    final servicePrice = (json['servicePriceAmount'] as num?)?.toInt() ?? 0;
    final travelFee = (json['travelFeeAmount'] as num?)?.toInt() ?? 0;
    final subtotal =
        (json['subtotalAmount'] as num?)?.toInt() ?? (servicePrice + travelFee);
    final discount = (json['discountAmount'] as num?)?.toInt() ?? 0;
    final total =
        (json['totalAmount'] as num?)?.toInt() ?? (subtotal - discount);

    return CustomerOrderEntity(
      id: json['id']?.toString() ?? '',
      bookingType: json['bookingType']?.toString() ?? 'ASAP',
      scheduledAt: parseDate(json['scheduledAt']),
      status: json['status']?.toString() ?? 'PENDING_PROVIDER',
      rejectionReason: json['rejectionReason']?.toString(),
      paymentMethod: json['paymentMethod']?.toString() ?? 'CASH',
      serviceName: json['serviceName']?.toString() ?? 'Dịch vụ làm đẹp',
      servicePriceAmount: servicePrice,
      travelFeeAmount: travelFee,
      travelDistanceKm: (json['travelDistanceKm'] as num?)?.toDouble(),
      subtotalAmount: subtotal,
      discountAmount: discount,
      voucherCode: json['voucherCode']?.toString(),
      voucherIssuer: json['voucherIssuer']?.toString(),
      totalAmount: total,
      currencyCode: json['currencyCode']?.toString() ?? 'VND',
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 60,
      providerResponseDeadlineAt: parseDate(json['providerResponseDeadlineAt']),
      expectedStartAt: parseDate(json['expectedStartAt']),
      expectedEndAt: parseDate(json['expectedEndAt']),
      addressLabel: json['addressLabel']?.toString(),
      addressLine: json['addressLine']?.toString(),
      addressNote: json['addressNote']?.toString(),
      addressLatitude: (json['addressLatitude'] as num?)?.toDouble(),
      addressLongitude: (json['addressLongitude'] as num?)?.toDouble(),
      contactName: json['contactName']?.toString(),
      contactPhone: json['contactPhone']?.toString(),
      customerNote: json['customerNote']?.toString(),
      provider: json['provider'] != null
          ? OrderProviderSummaryEntity.fromJson(
              json['provider'] as Map<String, dynamic>,
            )
          : null,
      statusHistory: historyList
          .whereType<Map<String, dynamic>>()
          .map((h) => OrderStatusHistoryEntity.fromJson(h))
          .toList(),
      evidence: evidenceList
          .whereType<Map<String, dynamic>>()
          .map((e) => OrderEvidenceEntity.fromJson(e))
          .toList(),
      cancellationRequest: json['cancellationRequest'] != null
          ? OrderCancellationRequestEntity.fromJson(
              json['cancellationRequest'] as Map<String, dynamic>,
            )
          : null,
      review: json['review'] != null
          ? OrderReviewEntity.fromJson(json['review'] as Map<String, dynamic>)
          : null,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
      paymentDispute:
          isPaymentDisputed(json['status'] as String?) ||
              json['paymentDisputeOpenedAt'] != null
          ? PaymentDisputeOrder.fromJson(json)
          : null,
      addOnSnapshot: json.containsKey('addOns')
          ? AddOnOrder.fromJson(json)
          : null,
      rescheduleRequest: json['rescheduleRequest'] == null
          ? null
          : RescheduleProposal.fromJson(
              Map<String, dynamic>.from(json['rescheduleRequest'] as Map),
            ),
    );
  }

  @override
  List<Object?> get props => [
    id,
    bookingType,
    scheduledAt,
    status,
    rejectionReason,
    serviceName,
    servicePriceAmount,
    travelFeeAmount,
    travelDistanceKm,
    subtotalAmount,
    discountAmount,
    voucherCode,
    voucherIssuer,
    totalAmount,
    providerResponseDeadlineAt,
    provider,
    statusHistory,
    rescheduleRequest,
    addOnSnapshot,
    paymentDispute,
    cancellationRequest,
    review,
  ];
}

class OrderProviderSummaryEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? phone;
  final double? serviceRadiusKm;
  final double? rating;

  const OrderProviderSummaryEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.phone,
    this.serviceRadiusKm,
    this.rating,
  });

  factory OrderProviderSummaryEntity.fromJson(Map<String, dynamic> json) {
    return OrderProviderSummaryEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên',
      avatarUrl: json['avatarUrl']?.toString(),
      phone: json['phone']?.toString(),
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toDouble(),
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
    );
  }

  @override
  List<Object?> get props => [
    id,
    displayName,
    avatarUrl,
    phone,
    serviceRadiusKm,
    rating,
  ];
}

class OrderStatusHistoryEntity extends Equatable {
  final String id;
  final String? fromStatus;
  final String toStatus;
  final String? reason;
  final DateTime? createdAt;

  const OrderStatusHistoryEntity({
    required this.id,
    this.fromStatus,
    required this.toStatus,
    this.reason,
    this.createdAt,
  });

  factory OrderStatusHistoryEntity.fromJson(Map<String, dynamic> json) {
    return OrderStatusHistoryEntity(
      id: json['id']?.toString() ?? '',
      fromStatus: json['fromStatus']?.toString(),
      toStatus: json['toStatus']?.toString() ?? '',
      reason: json['reason']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())?.toLocal()
          : null,
    );
  }

  @override
  List<Object?> get props => [id, fromStatus, toStatus, reason, createdAt];
}

class OrderEvidenceEntity extends Equatable {
  final String id;
  final String type; // ARRIVAL, BEFORE_WORK, AFTER_WORK, INCIDENT
  final DateTime? capturedAt;

  const OrderEvidenceEntity({
    required this.id,
    required this.type,
    this.capturedAt,
  });

  factory OrderEvidenceEntity.fromJson(Map<String, dynamic> json) {
    return OrderEvidenceEntity(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      capturedAt: json['capturedAt'] != null
          ? DateTime.tryParse(json['capturedAt'].toString())?.toLocal()
          : null,
    );
  }

  @override
  List<Object?> get props => [id, type, capturedAt];
}

class OrderCancellationRequestEntity extends Equatable {
  final String id;
  final String reason;
  final String? detail;
  final String status; // PENDING_CUSTOMER, APPROVED, DENIED, SUPPORT_REVIEW
  final DateTime? createdAt;

  const OrderCancellationRequestEntity({
    required this.id,
    required this.reason,
    this.detail,
    required this.status,
    this.createdAt,
  });

  factory OrderCancellationRequestEntity.fromJson(Map<String, dynamic> json) {
    return OrderCancellationRequestEntity(
      id: json['id']?.toString() ?? '',
      reason: json['reason']?.toString() ?? '',
      detail: json['detail']?.toString(),
      status: json['status']?.toString() ?? 'PENDING_CUSTOMER',
      createdAt: json['requestedAt'] != null || json['createdAt'] != null
          ? DateTime.tryParse(
              (json['requestedAt'] ?? json['createdAt']).toString(),
            )?.toLocal()
          : null,
    );
  }

  @override
  List<Object?> get props => [id, reason, detail, status, createdAt];
}

class OrderReviewEntity extends Equatable {
  final String id;
  final int rating;
  final String? comment;
  final DateTime? createdAt;

  const OrderReviewEntity({
    required this.id,
    required this.rating,
    this.comment,
    this.createdAt,
  });

  factory OrderReviewEntity.fromJson(Map<String, dynamic> json) {
    return OrderReviewEntity(
      id: json['id']?.toString() ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      comment: json['comment']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())?.toLocal()
          : null,
    );
  }

  @override
  List<Object?> get props => [id, rating, comment, createdAt];
}
