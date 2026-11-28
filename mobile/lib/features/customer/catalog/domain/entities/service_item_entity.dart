import 'package:equatable/equatable.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

class ServiceCategorySummaryEntity extends Equatable {
  final String id;
  final String code;
  final String name;
  final String slug;

  const ServiceCategorySummaryEntity({
    required this.id,
    required this.code,
    required this.name,
    required this.slug,
  });

  factory ServiceCategorySummaryEntity.fromJson(Map<String, dynamic> json) {
    return ServiceCategorySummaryEntity(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'slug': slug,
  };

  @override
  List<Object?> get props => [id, code, name, slug];
}

class ServiceItemEntity extends Equatable {
  final String id;
  final String code;
  final String name;
  final String slug;
  final String? description;
  final String? iconUrl;
  final String? coverImageUrl;
  final int minPriceAmount;
  final int maxPriceAmount;
  final String currencyCode;
  final int defaultDurationMinutes;
  final String targetAudience;
  final bool requiresCertificate;
  final int minExperienceYears;
  final double? rating;
  final int reviewCount;
  final List<PublicReviewItemEntity> reviews;
  final ServiceCategorySummaryEntity category;

  const ServiceItemEntity({
    required this.id,
    required this.code,
    required this.name,
    required this.slug,
    this.description,
    this.iconUrl,
    this.coverImageUrl,
    required this.minPriceAmount,
    required this.maxPriceAmount,
    this.currencyCode = 'VND',
    this.defaultDurationMinutes = 45,
    this.targetAudience = 'ALL',
    this.requiresCertificate = false,
    this.minExperienceYears = 0,
    this.rating,
    this.reviewCount = 0,
    this.reviews = const [],
    required this.category,
  });

  factory ServiceItemEntity.fromJson(Map<String, dynamic> json) {
    final catJson = json['category'];
    final category = catJson is Map<String, dynamic>
        ? ServiceCategorySummaryEntity.fromJson(catJson)
        : const ServiceCategorySummaryEntity(
            id: '',
            code: '',
            name: '',
            slug: '',
          );
    final summary = json['reviewSummary'] is Map
        ? Map<String, dynamic>.from(json['reviewSummary'] as Map)
        : null;
    final rawCount = summary != null ? summary['count'] : json['reviewCount'];
    final reviewCount = (rawCount as num?)?.toInt() ?? 0;
    final rawRating = summary != null
        ? summary['averageRating']
        : json['rating'];
    final rating = (rawRating as num?)?.toDouble();
    final rawReviews = json['reviews'] is List ? json['reviews'] as List : [];

    return ServiceItemEntity(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String?,
      iconUrl: json['iconUrl'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      minPriceAmount: (json['minPriceAmount'] as num?)?.toInt() ?? 0,
      maxPriceAmount: (json['maxPriceAmount'] as num?)?.toInt() ?? 0,
      currencyCode: json['currencyCode'] as String? ?? 'VND',
      defaultDurationMinutes:
          (json['defaultDurationMinutes'] as num?)?.toInt() ?? 45,
      targetAudience: json['targetAudience'] as String? ?? 'ALL',
      requiresCertificate: json['requiresCertificate'] as bool? ?? false,
      minExperienceYears: (json['minExperienceYears'] as num?)?.toInt() ?? 0,
      rating: rating,
      reviewCount: reviewCount,
      reviews: rawReviews
          .whereType<Map>()
          .map(
            (e) =>
                PublicReviewItemEntity.fromJson(Map<String, dynamic>.from(e)),
          )
          .toList(),
      category: category,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'slug': slug,
    'description': description,
    'iconUrl': iconUrl,
    'coverImageUrl': coverImageUrl,
    'minPriceAmount': minPriceAmount,
    'maxPriceAmount': maxPriceAmount,
    'currencyCode': currencyCode,
    'defaultDurationMinutes': defaultDurationMinutes,
    'targetAudience': targetAudience,
    'requiresCertificate': requiresCertificate,
    'minExperienceYears': minExperienceYears,
  };

  @override
  List<Object?> get props => [
    id,
    code,
    name,
    slug,
    description,
    iconUrl,
    coverImageUrl,
    minPriceAmount,
    maxPriceAmount,
    currencyCode,
    defaultDurationMinutes,
    targetAudience,
    requiresCertificate,
    minExperienceYears,
    rating,
    reviewCount,
    reviews,
    category,
  ];
}

class ServiceReviewsPage {
  final int count;
  final double? averageRating;
  final List<PublicReviewItemEntity> reviews;
  final String? nextCursor;

  const ServiceReviewsPage({
    required this.count,
    this.averageRating,
    required this.reviews,
    this.nextCursor,
  });

  factory ServiceReviewsPage.fromJson(Map<String, dynamic> json) {
    final rawReviews = json['reviews'] is List ? json['reviews'] as List : [];
    return ServiceReviewsPage(
      count: (json['count'] as num?)?.toInt() ?? 0,
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      reviews: rawReviews
          .whereType<Map>()
          .map(
            (e) =>
                PublicReviewItemEntity.fromJson(Map<String, dynamic>.from(e)),
          )
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
