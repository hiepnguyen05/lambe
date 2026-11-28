import 'package:equatable/equatable.dart';

class PublicServiceItemEntity extends Equatable {
  final String id;
  final String serviceId;
  final String name;
  final String slug;
  final String? coverImageUrl;
  final String? iconUrl;
  final String categoryName;
  final String categorySlug;
  final int priceAmount;
  final int durationMinutes;
  final String? description;

  const PublicServiceItemEntity({
    required this.id,
    required this.serviceId,
    required this.name,
    required this.slug,
    this.coverImageUrl,
    this.iconUrl,
    required this.categoryName,
    required this.categorySlug,
    required this.priceAmount,
    required this.durationMinutes,
    this.description,
  });

  factory PublicServiceItemEntity.fromJson(Map<String, dynamic> json) {
    final service = (json['service'] as Map<String, dynamic>?) ?? {};
    final category = (service['category'] as Map<String, dynamic>?) ?? {};

    return PublicServiceItemEntity(
      id: json['id']?.toString() ?? '',
      serviceId: service['id']?.toString() ?? '',
      name: service['name']?.toString() ?? 'Dịch vụ làm đẹp',
      slug: service['slug']?.toString() ?? '',
      coverImageUrl: service['coverImageUrl']?.toString(),
      iconUrl:
          service['iconUrl']?.toString() ?? category['iconUrl']?.toString(),
      categoryName: category['name']?.toString() ?? 'Dịch vụ',
      categorySlug: category['slug']?.toString() ?? '',
      priceAmount: (json['priceAmount'] as num?)?.toInt() ?? 0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 30,
      description: json['description']?.toString(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    serviceId,
    name,
    slug,
    coverImageUrl,
    iconUrl,
    categoryName,
    categorySlug,
    priceAmount,
    durationMinutes,
    description,
  ];
}

class PublicReviewItemEntity extends Equatable {
  final String id;
  final int rating;
  final String comment;
  final DateTime createdAt;
  final String customerName;
  final String? customerAvatar;
  final String? assignedMemberName;

  const PublicReviewItemEntity({
    required this.id,
    required this.rating,
    required this.comment,
    required this.createdAt,
    required this.customerName,
    this.customerAvatar,
    this.assignedMemberName,
  });

  factory PublicReviewItemEntity.fromJson(Map<String, dynamic> json) {
    final assigned = json['assignedMember'];
    final assignedName = assigned is Map
        ? assigned['displayName']?.toString()
        : null;
    return PublicReviewItemEntity(
      id: json['id']?.toString() ?? '',
      rating: ((json['rating'] as num?)?.toInt() ?? 0).clamp(0, 5),
      comment: json['comment']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      customerName: json['customerName']?.toString() ?? 'Khách hàng',
      customerAvatar: json['customerAvatar']?.toString(),
      assignedMemberName: assignedName,
    );
  }

  @override
  List<Object?> get props => [
    id,
    rating,
    comment,
    createdAt,
    customerName,
    customerAvatar,
    assignedMemberName,
  ];
}

class PublicPortfolioItemEntity extends Equatable {
  final String id;
  final String title;
  final String imageUrl;
  final int likesCount;

  const PublicPortfolioItemEntity({
    required this.id,
    required this.title,
    required this.imageUrl,
    this.likesCount = 0,
  });

  factory PublicPortfolioItemEntity.fromJson(Map<String, dynamic> json) {
    return PublicPortfolioItemEntity(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      likesCount: (json['likesCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, title, imageUrl, likesCount];
}

class PartnerPublicProfileEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String biography;
  final int experienceYears;
  final String serviceAreaName;
  final int serviceRadiusKm;
  final bool isOnline;
  final bool isVerified;
  final int completedOrdersCount;
  final double? rating;
  final int reviewCount;
  final double? acceptanceRate;
  final double? onTimeRate;
  final List<PublicServiceItemEntity> services;
  final List<PublicReviewItemEntity> reviews;
  final List<PublicPortfolioItemEntity> portfolio;

  const PartnerPublicProfileEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    required this.biography,
    required this.experienceYears,
    required this.serviceAreaName,
    required this.serviceRadiusKm,
    this.isOnline = false,
    this.isVerified = true,
    this.completedOrdersCount = 0,
    this.rating,
    this.reviewCount = 0,
    this.acceptanceRate,
    this.onTimeRate,
    this.services = const [],
    this.reviews = const [],
    this.portfolio = const [],
  });

  /// Danh sách danh mục dịch vụ thực tế của chuyên viên
  List<String> get categories {
    final set = <String>{};
    for (final s in services) {
      if (s.categoryName.isNotEmpty) {
        set.add(s.categoryName);
      }
    }
    return set.toList();
  }

  /// Mức giá dịch vụ khởi điểm thực tế
  int get startingPrice {
    if (services.isEmpty) return 0;
    int min = services.first.priceAmount;
    for (final s in services) {
      if (s.priceAmount > 0 && (min == 0 || s.priceAmount < min)) {
        min = s.priceAmount;
      }
    }
    return min;
  }

  factory PartnerPublicProfileEntity.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map<String, dynamic>?) ?? {};
    final rawServices = (json['services'] as List<dynamic>?) ?? [];
    final rawReviews = (json['reviews'] as List<dynamic>?) ?? [];
    final rawPortfolio = (json['portfolio'] as List<dynamic>?) ?? [];

    return PartnerPublicProfileEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? 'Chuyên viên Lambe',
      avatarUrl: json['avatarUrl']?.toString(),
      biography: json['biography']?.toString() ?? '',
      experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 1,
      serviceAreaName: json['serviceAreaName']?.toString() ?? 'TP. Hồ Chí Minh',
      serviceRadiusKm: (json['serviceRadiusKm'] as num?)?.toInt() ?? 5,
      isOnline: json['online'] == true,
      isVerified: true,
      completedOrdersCount:
          (stats['completedOrdersCount'] as num?)?.toInt() ?? 0,
      rating: (stats['rating'] as num?)?.toDouble(),
      reviewCount: (stats['reviewCount'] as num?)?.toInt() ?? 0,
      acceptanceRate: (stats['acceptanceRate'] as num?)?.toDouble(),
      onTimeRate: (stats['onTimeRate'] as num?)?.toDouble(),
      services: rawServices
          .map(
            (e) => PublicServiceItemEntity.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      reviews: rawReviews
          .map(
            (e) => PublicReviewItemEntity.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
      portfolio: rawPortfolio
          .map(
            (e) =>
                PublicPortfolioItemEntity.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  @override
  List<Object?> get props => [
    id,
    displayName,
    avatarUrl,
    biography,
    experienceYears,
    serviceAreaName,
    serviceRadiusKm,
    isOnline,
    isVerified,
    completedOrdersCount,
    rating,
    reviewCount,
    acceptanceRate,
    onTimeRate,
    services,
    reviews,
    portfolio,
  ];
}
