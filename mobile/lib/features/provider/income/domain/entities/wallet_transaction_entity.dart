enum TransactionType {
  topUp,
  commissionDeduction,
  hold,
  release,
  voucherReimbursement,
  withdrawal,
  refund,
  manualAdjustment,
}

class WalletTransactionEntity {
  final String id;
  final TransactionType type;
  final double amount;
  final double? balanceBefore;
  final double balanceAfter;
  final double? heldBefore;
  final double? heldAfter;
  final String description;
  final DateTime createdAt;
  final String? referenceId;

  const WalletTransactionEntity({
    required this.id,
    required this.type,
    required this.amount,
    this.balanceBefore,
    required this.balanceAfter,
    this.heldBefore,
    this.heldAfter,
    required this.description,
    required this.createdAt,
    this.referenceId,
  });

  /// Available balance right after this ledger entry was applied.
  double get availableAfter => balanceAfter - (heldAfter ?? 0.0);

  /// Whether this entry increases the provider's available/wallet balance.
  bool get isCredit {
    switch (type) {
      case TransactionType.topUp:
      case TransactionType.refund:
      case TransactionType.voucherReimbursement:
      case TransactionType.release:
        return true;
      case TransactionType.commissionDeduction:
      case TransactionType.withdrawal:
      case TransactionType.hold:
        return false;
      case TransactionType.manualAdjustment:
        if (balanceBefore != null) {
          return balanceAfter >= balanceBefore!;
        }
        return amount >= 0;
    }
  }

  String get badgeLabel {
    switch (type) {
      case TransactionType.topUp:
        return 'Nạp tiền';
      case TransactionType.commissionDeduction:
        return 'Hoa hồng';
      case TransactionType.hold:
        return 'Tạm giữ';
      case TransactionType.release:
        return 'Hoàn tạm giữ';
      case TransactionType.voucherReimbursement:
        return 'Trợ giá voucher';
      case TransactionType.refund:
        return 'Hoàn tiền';
      case TransactionType.withdrawal:
        return 'Rút tiền';
      case TransactionType.manualAdjustment:
        return 'Điều chỉnh';
    }
  }

  String get displayTitle {
    final trimmed = description.trim();
    if (trimmed.isNotEmpty) {
      if (trimmed == 'PLATFORM_VOUCHER') {
        return 'Bù trợ giá voucher sàn';
      }
      if (trimmed == 'ORDER_ADD_ON') {
        return 'Tạm giữ hoa hồng dịch vụ phát sinh';
      }
      final upper = trimmed.toUpperCase();
      if (upper.startsWith('MOMO TRANSACTION')) {
        return 'Nạp tiền ví qua MoMo';
      }
      if (upper.startsWith('SEPAY TRANSACTION')) {
        return 'Nạp tiền ví qua SePay';
      }
      return trimmed;
    }

    switch (type) {
      case TransactionType.topUp:
        return 'Nạp tiền vào ví';
      case TransactionType.commissionDeduction:
        return 'Khấu trừ hoa hồng đơn hàng';
      case TransactionType.hold:
        return 'Tạm giữ hoa hồng nhận đơn';
      case TransactionType.release:
        return 'Giải phóng tiền tạm giữ';
      case TransactionType.voucherReimbursement:
        return 'Bù trợ giá voucher sàn';
      case TransactionType.refund:
        return 'Hoàn tiền vào ví';
      case TransactionType.withdrawal:
        return 'Rút tiền từ ví';
      case TransactionType.manualAdjustment:
        return 'Điều chỉnh số dư ví';
    }
  }

  String? get shortOrderCode {
    final ref = referenceId?.trim();
    if (ref == null || ref.isEmpty) return null;
    final clean = ref.replaceAll('-', '').toUpperCase();
    return '#${clean.length > 8 ? clean.substring(0, 8) : clean}';
  }

  factory WalletTransactionEntity.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json['createdAt']?.toString();
    final parsedCreatedAt = rawCreatedAt != null
        ? DateTime.tryParse(rawCreatedAt)?.toLocal()
        : null;

    return WalletTransactionEntity(
      id: json['id']?.toString() ?? '',
      type: _parseType(json['type']?.toString()),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      balanceBefore: (json['balanceBeforeAmount'] as num?)?.toDouble(),
      balanceAfter:
          ((json['balanceAfterAmount'] ?? json['balanceAfter']) as num?)
              ?.toDouble() ??
          0.0,
      heldBefore: (json['heldBeforeAmount'] as num?)?.toDouble(),
      heldAfter: (json['heldAfterAmount'] as num?)?.toDouble(),
      description: (json['reason'] ?? json['description'])?.toString() ?? '',
      createdAt: parsedCreatedAt ?? DateTime.now(),
      referenceId: (json['orderId'] ?? json['referenceId'])?.toString(),
    );
  }

  static TransactionType _parseType(String? typeStr) {
    switch (typeStr) {
      case 'TOP_UP':
        return TransactionType.topUp;
      case 'COMMISSION':
      case 'COMMISSION_DEDUCTION':
        return TransactionType.commissionDeduction;
      case 'HOLD':
        return TransactionType.hold;
      case 'RELEASE':
        return TransactionType.release;
      case 'VOUCHER_REIMBURSEMENT':
        return TransactionType.voucherReimbursement;
      case 'WITHDRAWAL':
        return TransactionType.withdrawal;
      case 'REFUND':
        return TransactionType.refund;
      case 'ADJUSTMENT':
      case 'MANUAL_ADJUSTMENT':
      default:
        return TransactionType.manualAdjustment;
    }
  }
}
