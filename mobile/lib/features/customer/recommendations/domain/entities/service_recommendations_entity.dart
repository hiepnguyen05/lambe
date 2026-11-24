class ServiceRecommendationsEntity {
  final bool personalized;
  final List<RecommendedServiceEntity> services;

  const ServiceRecommendationsEntity({
    required this.personalized,
    required this.services,
  });

  factory ServiceRecommendationsEntity.fromJson(Map<String, dynamic> json) {
    final services = <RecommendedServiceEntity>[];
    final rawServices = json['services'];
    if (rawServices is List) {
      for (final item in rawServices) {
        if (item is! Map) continue;
        services.add(
          RecommendedServiceEntity.fromJson(Map<String, dynamic>.from(item)),
        );
      }
    }

    return ServiceRecommendationsEntity(
      personalized: json['personalized'] == true,
      services: services,
    );
  }
}

class RecommendedServiceEntity {
  final String id;
  final String name;
  final String? description;
  final String? iconUrl;
  final String? coverImageUrl;
  final int? minPriceAmount;
  final int? maxPriceAmount;
  final String currencyCode;
  final int? defaultDurationMinutes;
  final String categoryName;
  final int recommendationScore;

  const RecommendedServiceEntity({
    required this.id,
    required this.name,
    this.description,
    this.iconUrl,
    this.coverImageUrl,
    this.minPriceAmount,
    this.maxPriceAmount,
    this.currencyCode = 'VND',
    this.defaultDurationMinutes,
    this.categoryName = 'Làm đẹp',
    this.recommendationScore = 0,
  });

  factory RecommendedServiceEntity.fromJson(Map<String, dynamic> json) {
    final rawCategory = json['category'];
    final category = rawCategory is Map
        ? Map<String, dynamic>.from(rawCategory)
        : const <String, dynamic>{};

    return RecommendedServiceEntity(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Dịch vụ',
      description: json['description']?.toString(),
      iconUrl: json['iconUrl']?.toString(),
      coverImageUrl: json['coverImageUrl']?.toString(),
      minPriceAmount: (json['minPriceAmount'] as num?)?.toInt(),
      maxPriceAmount: (json['maxPriceAmount'] as num?)?.toInt(),
      currencyCode: json['currencyCode']?.toString() ?? 'VND',
      defaultDurationMinutes: (json['defaultDurationMinutes'] as num?)?.toInt(),
      categoryName: category['name']?.toString() ?? 'Làm đẹp',
      recommendationScore: (json['recommendationScore'] as num?)?.toInt() ?? 0,
    );
  }
}
