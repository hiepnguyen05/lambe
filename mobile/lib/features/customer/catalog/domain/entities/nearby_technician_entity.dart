import 'package:equatable/equatable.dart';

class NearbyTechnicianEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final int experienceYears;
  final double distanceKm;
  final double? rating;
  final int reviewCount;
  final String badge;
  final bool isOnline;
  final int? priceAmount;

  const NearbyTechnicianEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.experienceYears = 0,
    this.distanceKm = 0,
    this.rating,
    this.reviewCount = 0,
    this.badge = '',
    this.isOnline = true,
    this.priceAmount,
  });

  factory NearbyTechnicianEntity.fromJson(Map<String, dynamic> json) {
    final exp = json['experienceYears'] is num
        ? (json['experienceYears'] as num).toInt()
        : 0;
    final dist = json['distanceKm'] is num
        ? (json['distanceKm'] as num).toDouble()
        : 0.0;
    final online = json['available'] == true;
    final service = json['service'] as Map<String, dynamic>?;
    final price = service != null && service['priceAmount'] is num
        ? (service['priceAmount'] as num).toInt()
        : null;
    final summary = json['reviewSummary'] is Map
        ? Map<String, dynamic>.from(json['reviewSummary'] as Map)
        : null;
    final rawCount = summary != null ? summary['count'] : json['reviewCount'];
    final reviewCount = (rawCount as num?)?.toInt() ?? 0;
    final rawRating = summary != null
        ? summary['averageRating']
        : json['rating'];
    final parsedRating = (rawRating as num?)?.toDouble();

    return NearbyTechnicianEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      experienceYears: exp,
      distanceKm: dist,
      rating: parsedRating,
      reviewCount: reviewCount,
      badge: json['badge']?.toString() ?? '',
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
