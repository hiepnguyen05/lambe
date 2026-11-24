import 'package:equatable/equatable.dart';

bool isPaymentDisputed(String? status) =>
    status == 'PAYMENT_DISPUTE' || status == 'DISPUTED';

enum PaymentDisputeRole { customer, provider }

class PaymentDisputeScope extends Equatable {
  final String orderId;
  final PaymentDisputeRole role;
  const PaymentDisputeScope(this.orderId, this.role);
  String get path => role == PaymentDisputeRole.provider
      ? '/me/provider/orders/$orderId'
      : '/me/orders/$orderId';
  @override
  List<Object?> get props => [orderId, role];
}

class CommissionHold extends Equatable {
  final int amount;
  final String status;
  const CommissionHold(this.amount, this.status);
  factory CommissionHold.fromJson(Map<String, dynamic> json) {
    final amount = json['amount'];
    if (amount is! int ||
        amount < 0 ||
        !const {'ACTIVE', 'CAPTURED', 'RELEASED'}.contains(json['status'])) {
      throw const FormatException('Khoản tạm giữ không hợp lệ.');
    }
    return CommissionHold(amount, json['status'] as String);
  }
  @override
  List<Object?> get props => [amount, status];
}

class PaymentDisputeOrder extends Equatable {
  final String id, status, currency;
  final int totalAmount;
  final String? reason;
  final DateTime? openedAt, decidedAt;
  final CommissionHold? hold;
  final bool afterWorkEvidence, pendingCancellation;
  const PaymentDisputeOrder({
    required this.id,
    required this.status,
    required this.totalAmount,
    required this.currency,
    this.reason,
    this.openedAt,
    this.decidedAt,
    this.hold,
    this.afterWorkEvidence = false,
    this.pendingCancellation = false,
  });
  bool get active => isPaymentDisputed(status);
  bool get hasHistory => openedAt != null;
  factory PaymentDisputeOrder.fromJson(Map<String, dynamic> json) {
    final amount = json['totalAmount'];
    if (json['id'] is! String ||
        json['status'] is! String ||
        amount is! int ||
        amount < 0 ||
        json['currencyCode'] is! String) {
      throw const FormatException('Thông tin thanh toán không hợp lệ.');
    }
    return PaymentDisputeOrder(
      id: json['id'] as String,
      status: json['status'] as String,
      totalAmount: amount,
      currency: json['currencyCode'] as String,
      reason: json['paymentDisputeReason'] as String?,
      openedAt: _date(json['paymentDisputeOpenedAt']),
      decidedAt: _date(json['paymentDisputeDecidedAt']),
      hold: json['commissionHold'] == null
          ? null
          : CommissionHold.fromJson(
              Map<String, dynamic>.from(json['commissionHold'] as Map),
            ),
      afterWorkEvidence: (json['evidence'] as List? ?? []).whereType<Map>().any(
        (row) => row['type'] == 'AFTER_WORK',
      ),
      pendingCancellation: const {
        'PENDING_CUSTOMER',
        'SUPPORT_REVIEW',
      }.contains((json['cancellationRequest'] as Map?)?['status']),
    );
  }
  static DateTime? _date(Object? value) =>
      value == null ? null : DateTime.parse(value.toString()).toUtc();
  @override
  List<Object?> get props => [
    id,
    status,
    totalAmount,
    currency,
    reason,
    openedAt,
    decidedAt,
    hold,
    afterWorkEvidence,
    pendingCancellation,
  ];
}

String? validatePaymentDisputeReason(String value) {
  final length = value.trim().runes.length;
  return length < 10 || length > 500 ? 'Mô tả cần từ 10 đến 500 ký tự.' : null;
}
