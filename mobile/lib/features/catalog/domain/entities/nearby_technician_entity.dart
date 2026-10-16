import 'package:equatable/equatable.dart';

class NearbyTechnicianEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final int experienceYears;
  final double distanceKm;
  final double rating;
  final int reviewCount;
  final String badge;
  final bool isOnline;
  final int? priceAmount;

  const NearbyTechnicianEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.experienceYears = 3,
    this.distanceKm = 1.8,
    this.rating = 4.98,
    this.reviewCount = 120,
    this.badge = 'CCCD ✓',
    this.isOnline = true,
    this.priceAmount,
  });

  factory NearbyTechnicianEntity.fromJson(Map<String, dynamic> json) {
    final exp = json['experienceYears'] is num ? (json['experienceYears'] as num).toInt() : 3;
    final dist = json['distanceKm'] is num ? (json['distanceKm'] as num).toDouble() : 1.8;
    final online = json['available'] == true;
    final service = json['service'] as Map<String, dynamic>?;
    final price = service != null && service['priceAmount'] is num
        ? (service['priceAmount'] as num).toInt()
        : null;

    return NearbyTechnicianEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      experienceYears: exp,
      distanceKm: dist,
      rating: 4.95 + ((exp % 5) * 0.01),
      reviewCount: 80 + (exp * 25),
      badge: exp >= 4 ? 'Nghệ nhân' : 'CCCD ✓',
      isOnline: online,
      priceAmount: price,
    );
  }

  @override
  List<Object?> get props => [
        id,
        displayName,
        avatarUrl,
        experienceYears,
        distanceKm,
        rating,
        reviewCount,
        badge,
        isOnline,
        priceAmount,
      ];
}
