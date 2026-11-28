import 'package:equatable/equatable.dart';
import 'package:mobile/core/utils/currency_utils.dart';

class VoucherEntity extends Equatable {
  final String code;
  final String issuer; // 'PLATFORM' | 'PROVIDER'
  final String discountType; // 'PERCENTAGE' | 'FIXED_AMOUNT'
  final int value;
  final int? maxDiscountAmount;
  final int minOrderAmount;
  final DateTime endsAt;
  final int estimatedDiscountAmount;

  const VoucherEntity({
    required this.code,
    required this.issuer,
    required this.discountType,
    required this.value,
    this.maxDiscountAmount,
    this.minOrderAmount = 0,
    required this.endsAt,
    this.estimatedDiscountAmount = 0,
  });

  bool get isPlatform => issuer == 'PLATFORM';
  bool get isProvider => issuer == 'PROVIDER';
  bool get isPercentage => discountType == 'PERCENTAGE';

  String get discountLabel {
    final currencyFormat = CurrencyUtils.vndCurrency;
    if (isPercentage) {
      if (maxDiscountAmount != null && maxDiscountAmount! > 0) {
        return 'Giảm $value% (tối đa ${currencyFormat.format(maxDiscountAmount)})';
      }
      return 'Giảm $value%';
    }
    return 'Giảm ${currencyFormat.format(value)}';
  }

  String get issuerLabel => isPlatform ? 'Sàn Lambe' : 'Thợ ưu đãi';

  factory VoucherEntity.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v) {
      if (v == null) return DateTime.now().add(const Duration(days: 30));
      return DateTime.tryParse(v.toString()) ?? DateTime.now();
    }

    return VoucherEntity(
      code: json['code']?.toString() ?? '',
      issuer: json['issuer']?.toString() ?? 'PLATFORM',
      discountType: json['discountType']?.toString() ?? 'FIXED_AMOUNT',
      value: (json['value'] as num?)?.toInt() ?? 0,
      maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toInt(),
      minOrderAmount: (json['minOrderAmount'] as num?)?.toInt() ?? 0,
      endsAt: parseDate(json['endsAt']),
      estimatedDiscountAmount:
          (json['estimatedDiscountAmount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [
    code,
    issuer,
    discountType,
    value,
    maxDiscountAmount,
    minOrderAmount,
    endsAt,
    estimatedDiscountAmount,
  ];
}
