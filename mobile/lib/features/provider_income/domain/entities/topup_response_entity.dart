class TopUpResponseEntity {
  final String id;
  final double amount;
  final String status;
  final String provider;
  final String orderId;
  final String? payUrl;
  final String? deeplink;
  final String? qrCodeUrl;
  final DateTime? expiresAt;
  final DateTime? paidAt;
  final String? resultMessage;

  const TopUpResponseEntity({
    required this.id,
    required this.amount,
    required this.status,
    required this.provider,
    required this.orderId,
    this.payUrl,
    this.deeplink,
    this.qrCodeUrl,
    this.expiresAt,
    this.paidAt,
    this.resultMessage,
  });

  bool get isPending => status == 'PENDING_PAYMENT';
  bool get isSucceeded => status == 'SUCCEEDED';
  bool get isFailed => status == 'FAILED';
  bool get isExpired => status == 'EXPIRED';

  factory TopUpResponseEntity.fromJson(Map<String, dynamic> json) {
    return TopUpResponseEntity(
      id: json['id'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'PENDING_PAYMENT',
      provider: json['provider'] as String? ?? '',
      orderId: json['orderId'] as String? ?? '',
      payUrl: json['payUrl'] as String?,
      deeplink: json['deeplink'] as String?,
      qrCodeUrl: json['qrCodeUrl'] as String?,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String)
          : null,
      paidAt: json['paidAt'] != null
          ? DateTime.tryParse(json['paidAt'] as String)
          : null,
      resultMessage: json['resultMessage'] as String?,
    );
  }
}
