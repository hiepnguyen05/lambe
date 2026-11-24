import 'package:equatable/equatable.dart';

class OrderQuoteEntity extends Equatable {
  final String? providerId;
  final String? providerDisplayName;
  final String providerServiceId;
  final String serviceName;
  final int servicePriceAmount;
  final int travelFeeAmount;
  final int? subtotalAmount;
  final int discountAmount;
  final double? travelDistanceKm;
  final String? distanceSource;
  final String? quoteToken;
  final String? voucherCode;
  final String? voucherIssuer;
  final int totalAmount;
  final String currencyCode;
  final int durationMinutes;
  final double distanceKm;
  final String bookingType;
  final DateTime? scheduledAt;
  final DateTime? expectedStartAt;
  final DateTime? expectedEndAt;
  final bool available;
  final String? reason;
  final List<DateTime> suggestedSlots;
  final String? estimateSource;
  final bool requiresProviderConfirmation;

  const OrderQuoteEntity({
    this.providerId,
    this.providerDisplayName,
    required this.providerServiceId,
    required this.serviceName,
    required this.servicePriceAmount,
    this.travelFeeAmount = 0,
    this.subtotalAmount,
    this.discountAmount = 0,
    this.travelDistanceKm,
    this.distanceSource,
    this.quoteToken,
    this.voucherCode,
    this.voucherIssuer,
    required this.totalAmount,
    this.currencyCode = 'VND',
    this.durationMinutes = 60,
    this.distanceKm = 0.0,
    required this.bookingType,
    this.scheduledAt,
    this.expectedStartAt,
    this.expectedEndAt,
    this.available = true,
    this.reason,
    this.suggestedSlots = const [],
    this.estimateSource,
    this.requiresProviderConfirmation = true,
  });

  factory OrderQuoteEntity.fromJson(Map<String, dynamic> json) {
    final providerMap = json['provider'] as Map<String, dynamic>?;

    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString())?.toLocal();
    }

    final rawSlots = json['suggestedSlots'] as List<dynamic>? ?? [];
    final suggested = rawSlots
        .map((s) => parseDate(s))
        .whereType<DateTime>()
        .toList();

    final servicePrice = (json['servicePriceAmount'] as num?)?.toInt() ?? 0;
    final travelFee = (json['travelFeeAmount'] as num?)?.toInt() ?? 0;
    final subtotal =
        (json['subtotalAmount'] as num?)?.toInt() ?? (servicePrice + travelFee);
    final discount = (json['discountAmount'] as num?)?.toInt() ?? 0;
    final total =
        (json['totalAmount'] as num?)?.toInt() ?? (subtotal - discount);

    return OrderQuoteEntity(
      providerId:
          providerMap?['id']?.toString() ?? json['providerId']?.toString(),
      providerDisplayName:
          providerMap?['displayName']?.toString() ??
          json['providerDisplayName']?.toString(),
      providerServiceId: json['providerServiceId']?.toString() ?? '',
      serviceName: json['serviceName']?.toString() ?? 'Dịch vụ làm đẹp',
      servicePriceAmount: servicePrice,
      travelFeeAmount: travelFee,
      subtotalAmount: subtotal,
      discountAmount: discount,
      travelDistanceKm: (json['travelDistanceKm'] as num?)?.toDouble(),
      distanceSource: json['distanceSource']?.toString(),
      quoteToken: json['quoteToken']?.toString(),
      voucherCode: json['voucherCode']?.toString(),
      voucherIssuer: json['voucherIssuer']?.toString(),
      totalAmount: total,
      currencyCode: json['currencyCode']?.toString() ?? 'VND',
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 60,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0.0,
      bookingType: json['bookingType']?.toString() ?? 'ASAP',
      scheduledAt: parseDate(json['scheduledAt']),
      expectedStartAt: parseDate(json['expectedStartAt']),
      expectedEndAt: parseDate(json['expectedEndAt']),
      available: json['available'] == true,
      reason: json['reason']?.toString(),
      suggestedSlots: suggested,
      estimateSource: json['estimateSource']?.toString(),
      requiresProviderConfirmation:
          json['requiresProviderConfirmation'] ?? true,
    );
  }

  @override
  List<Object?> get props => [
    providerId,
    providerDisplayName,
    providerServiceId,
    serviceName,
    servicePriceAmount,
    travelFeeAmount,
    subtotalAmount,
    discountAmount,
    travelDistanceKm,
    distanceSource,
    quoteToken,
    voucherCode,
    voucherIssuer,
    totalAmount,
    currencyCode,
    durationMinutes,
    distanceKm,
    bookingType,
    scheduledAt,
    expectedStartAt,
    expectedEndAt,
    available,
    reason,
    suggestedSlots,
    estimateSource,
    requiresProviderConfirmation,
  ];
}
