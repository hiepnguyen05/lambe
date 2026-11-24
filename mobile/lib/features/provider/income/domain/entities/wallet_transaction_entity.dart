enum TransactionType {
  topUp,
  commissionDeduction,
  withdrawal,
  refund,
  manualAdjustment,
}

class WalletTransactionEntity {
  final String id;
  final TransactionType type;
  final double amount;
  final double balanceAfter;
  final String description;
  final DateTime createdAt;
  final String? referenceId;

  const WalletTransactionEntity({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.description,
    required this.createdAt,
    this.referenceId,
  });

  factory WalletTransactionEntity.fromJson(Map<String, dynamic> json) {
    return WalletTransactionEntity(
      id: json['id'] as String? ?? '',
      type: _parseType(json['type'] as String?),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      balanceAfter: (json['balanceAfter'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String).toLocal()
          : DateTime.now(),
      referenceId: json['referenceId'] as String?,
    );
  }

  static TransactionType _parseType(String? typeStr) {
    switch (typeStr) {
      case 'TOP_UP':
        return TransactionType.topUp;
      case 'COMMISSION_DEDUCTION':
        return TransactionType.commissionDeduction;
      case 'WITHDRAWAL':
        return TransactionType.withdrawal;
      case 'REFUND':
        return TransactionType.refund;
      case 'MANUAL_ADJUSTMENT':
      default:
        return TransactionType.manualAdjustment;
    }
  }
}
