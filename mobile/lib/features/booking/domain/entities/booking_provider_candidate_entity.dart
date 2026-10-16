import 'package:equatable/equatable.dart';

class BookingProviderCandidateEntity extends Equatable {
  final String id;
  final String providerType;
  final String displayName;
  final String? avatarUrl;
  final String? biography;
  final int experienceYears;
  final String? serviceAreaName;
  final double distanceKm;
  final bool available;
  final String? reason;
  final DateTime? expectedStartAt;
  final DateTime? expectedEndAt;
  final List<DateTime> suggestedSlots;
  final bool requiresProviderConfirmation;
  final String providerServiceId;
  final int priceAmount;
  final int durationMinutes;
  final double rating;
  final int reviewCount;
  final String badge;

  const BookingProviderCandidateEntity({
    required this.id,
    this.providerType = 'INDIVIDUAL',
    required this.displayName,
    this.avatarUrl,
    this.biography,
    this.experienceYears = 3,
    this.serviceAreaName,
    required this.distanceKm,
    required this.available,
    this.reason,
    this.expectedStartAt,
    this.expectedEndAt,
    this.suggestedSlots = const [],
    this.requiresProviderConfirmation = true,
    required this.providerServiceId,
    required this.priceAmount,
    this.durationMinutes = 60,
    this.rating = 4.95,
    this.reviewCount = 95,
    this.badge = 'Đã xác thực CCCD',
  });

  factory BookingProviderCandidateEntity.fromJson(Map<String, dynamic> json) {
    final exp = json['experienceYears'] is num
        ? (json['experienceYears'] as num).toInt()
        : 3;
    final dist = json['distanceKm'] is num
        ? (json['distanceKm'] as num).toDouble()
        : 1.5;

    final serviceMap = json['service'] as Map<String, dynamic>? ?? {};
    final providerServiceId = serviceMap['id']?.toString() ?? '';
    final price = serviceMap['priceAmount'] is num
        ? (serviceMap['priceAmount'] as num).toInt()
        : 0;
    final duration = serviceMap['durationMinutes'] is num
        ? (serviceMap['durationMinutes'] as num).toInt()
        : 60;

    DateTime? startAt;
    if (json['expectedStartAt'] != null) {
      startAt = DateTime.tryParse(json['expectedStartAt'].toString());
    }

    DateTime? endAt;
    if (json['expectedEndAt'] != null) {
      endAt = DateTime.tryParse(json['expectedEndAt'].toString());
    }

    final rawSlots = json['suggestedSlots'] as List<dynamic>? ?? [];
    final suggested = rawSlots
        .map((s) => DateTime.tryParse(s.toString()))
        .whereType<DateTime>()
        .toList();

    return BookingProviderCandidateEntity(
      id: json['id']?.toString() ?? '',
      providerType: json['providerType']?.toString() ?? 'INDIVIDUAL',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      biography: json['biography']?.toString(),
      experienceYears: exp,
      serviceAreaName: json['serviceAreaName']?.toString(),
      distanceKm: dist,
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
      rating: 4.9 + ((exp % 4) * 0.02),
      reviewCount: 45 + (exp * 20),
      badge: 'Đã xác thực',
    );
  }

  @override
  List<Object?> get props => [
        id,
        providerType,
        displayName,
        avatarUrl,
        biography,
        experienceYears,
        serviceAreaName,
        distanceKm,
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
