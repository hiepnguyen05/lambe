import 'package:equatable/equatable.dart';

class BookingProviderCandidateEntity extends Equatable {
  final String id;
  final String? memberId;
  final String providerType;
  final String displayName;
  final String? avatarUrl;
  final String? biography;
  final int experienceYears;
  final String? serviceAreaName;
  final double distanceKm;
  final double? estimatedTravelDistanceKm;
  final int? estimatedTravelFeeAmount;
  final bool available;
  final String? reason;
  final DateTime? expectedStartAt;
  final DateTime? expectedEndAt;
  final List<DateTime> suggestedSlots;
  final bool requiresProviderConfirmation;
  final String providerServiceId;
  final int priceAmount;
  final int durationMinutes;
  final double? rating;
  final int reviewCount;
  final String badge;

  const BookingProviderCandidateEntity({
    required this.id,
    this.memberId,
    this.providerType = 'INDIVIDUAL',
    required this.displayName,
    this.avatarUrl,
    this.biography,
    this.experienceYears = 0,
    this.serviceAreaName,
    required this.distanceKm,
    this.estimatedTravelDistanceKm,
    this.estimatedTravelFeeAmount,
    required this.available,
    this.reason,
    this.expectedStartAt,
    this.expectedEndAt,
    this.suggestedSlots = const [],
    this.requiresProviderConfirmation = true,
    required this.providerServiceId,
    required this.priceAmount,
    this.durationMinutes = 60,
    this.rating,
    this.reviewCount = 0,
    this.badge = '',
  });

  factory BookingProviderCandidateEntity.fromJson(Map<String, dynamic> json) {
    final exp = json['experienceYears'] is num
        ? (json['experienceYears'] as num).toInt()
        : 0;
    if (json['distanceKm'] is! num) {
      throw const FormatException('Thiếu khoảng cách đến chuyên viên.');
    }
    final dist = (json['distanceKm'] as num).toDouble();

    final serviceMap = json['service'] as Map<String, dynamic>? ?? {};
    final providerServiceId = serviceMap['id']?.toString() ?? '';
    final price = serviceMap['priceAmount'] is num
        ? (serviceMap['priceAmount'] as num).toInt()
        : 0;
    final duration = serviceMap['durationMinutes'] is num
        ? (serviceMap['durationMinutes'] as num).toInt()
        : 60;

    if (!dist.isFinite ||
        dist < 0 ||
        providerServiceId.isEmpty ||
        price <= 0 ||
        json['id'] is! String ||
        (json['id'] as String).isEmpty) {
      throw const FormatException('Dữ liệu chuyên viên không hợp lệ.');
    }
    final summary = json['reviewSummary'] as Map<String, dynamic>?;
    final ratingValue = summary != null
        ? summary['averageRating']
        : json['rating'];

    DateTime? startAt;
    if (json['expectedStartAt'] != null) {
      startAt = DateTime.tryParse(json['expectedStartAt'].toString())?.toLocal();
    }

    DateTime? endAt;
    if (json['expectedEndAt'] != null) {
      endAt = DateTime.tryParse(json['expectedEndAt'].toString())?.toLocal();
    }

    final rawSlots = json['suggestedSlots'] as List<dynamic>? ?? [];
    final suggested = rawSlots
        .map((s) => DateTime.tryParse(s.toString())?.toLocal())
        .whereType<DateTime>()
        .toList();

    return BookingProviderCandidateEntity(
      id: json['id']?.toString() ?? '',
      memberId: json['memberId']?.toString(),
      providerType: json['providerType']?.toString() ?? 'INDIVIDUAL',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      biography: json['biography']?.toString(),
      experienceYears: exp,
      serviceAreaName: json['serviceAreaName']?.toString(),
      distanceKm: dist,
      estimatedTravelDistanceKm: (json['estimatedTravelDistanceKm'] as num?)
          ?.toDouble(),
      estimatedTravelFeeAmount: (json['estimatedTravelFeeAmount'] as num?)
          ?.toInt(),
      available: json['available'] == true,
      reason: json['reason']?.toString(),
      expectedStartAt: startAt,
      expectedEndAt: endAt,
      suggestedSlots: suggested,
      requiresProviderConfirmation:
          json['requiresProviderConfirmation'] ?? true,
      providerServiceId: providerServiceId,
      priceAmount: price,
      durationMinutes: duration,
      rating: (ratingValue as num?)?.toDouble(),
      reviewCount:
          ((summary != null ? summary['count'] : json['reviewCount']) as num?)
              ?.toInt() ??
          0,
      badge: json['badge']?.toString() ?? '',
    );
  }

  @override
  List<Object?> get props => [
    id,
    memberId,
    providerType,
    displayName,
    avatarUrl,
    biography,
    experienceYears,
    serviceAreaName,
    distanceKm,
    estimatedTravelDistanceKm,
    estimatedTravelFeeAmount,
    available,
    reason,
    expectedStartAt,
    expectedEndAt,
    suggestedSlots,
    requiresProviderConfirmation,
    providerServiceId,
    priceAmount,
    durationMinutes,
    rating,
    reviewCount,
    badge,
  ];
}
