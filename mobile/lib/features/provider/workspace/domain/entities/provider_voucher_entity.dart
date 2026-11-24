import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';

class ProviderVoucherEntity extends Equatable {
  final String id;
  final String code;
  final String issuer;
  final String discountType; // 'PERCENTAGE' | 'FIXED_AMOUNT'
  final int value;
  final int? maxDiscountAmount;
  final int minOrderAmount;
  final DateTime startsAt;
  final DateTime endsAt;
  final int usageLimit;
  final int perCustomerLimit;
  final String status; // 'ACTIVE' | 'INACTIVE'
  final DateTime? disabledAt;
  final DateTime createdAt;
  final String? serviceId;

  const ProviderVoucherEntity({
    required this.id,
    required this.code,
    required this.issuer,
    required this.discountType,
    required this.value,
    this.maxDiscountAmount,
    this.minOrderAmount = 0,
    required this.startsAt,
    required this.endsAt,
    required this.usageLimit,
    this.perCustomerLimit = 1,
    required this.status,
    this.disabledAt,
    required this.createdAt,
    this.serviceId,
  });

  bool get isPercentage => discountType == 'PERCENTAGE';
  bool get isDisabled => disabledAt != null || status != 'ACTIVE';
  bool get isExpired => DateTime.now().isAfter(endsAt);
  bool get isOngoing =>
      !isDisabled && !isExpired && DateTime.now().isAfter(startsAt);

  String get statusLabel {
    if (isDisabled) return 'Đã ngừng';
    if (isExpired) return 'Đã hết hạn';
    if (DateTime.now().isBefore(startsAt)) return 'Chưa bắt đầu';
    return 'Đang áp dụng';
  }

  String get discountDescription {
    final currency = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );
    if (isPercentage) {
      if (maxDiscountAmount != null && maxDiscountAmount! > 0) {
        return 'Giảm $value% (tối đa ${currency.format(maxDiscountAmount)})';
      }
      return 'Giảm $value%';
    }
    return 'Giảm ${currency.format(value)}';
  }

  factory ProviderVoucherEntity.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v, {DateTime? fallback}) {
      if (v == null) return fallback ?? DateTime.now();
      return DateTime.tryParse(v.toString()) ?? fallback ?? DateTime.now();
    }

    return ProviderVoucherEntity(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      issuer: json['issuer']?.toString() ?? 'PROVIDER',
      discountType: json['discountType']?.toString() ?? 'FIXED_AMOUNT',
      value: (json['value'] as num?)?.toInt() ?? 0,
      maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toInt(),
      minOrderAmount: (json['minOrderAmount'] as num?)?.toInt() ?? 0,
      startsAt: parseDate(json['startsAt']),
      endsAt: parseDate(json['endsAt']),
      usageLimit: (json['usageLimit'] as num?)?.toInt() ?? 0,
      perCustomerLimit: (json['perCustomerLimit'] as num?)?.toInt() ?? 1,
      status: json['status']?.toString() ?? 'ACTIVE',
      disabledAt: json['disabledAt'] != null
          ? parseDate(json['disabledAt'])
          : null,
      createdAt: parseDate(json['createdAt']),
      serviceId: json['serviceId']?.toString(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    code,
    issuer,
    discountType,
    value,
    maxDiscountAmount,
    minOrderAmount,
    startsAt,
    endsAt,
    usageLimit,
    perCustomerLimit,
    status,
    disabledAt,
    createdAt,
    serviceId,
  ];
}
