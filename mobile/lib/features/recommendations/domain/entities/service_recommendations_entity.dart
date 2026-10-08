class ServiceRecommendationsEntity {
  final bool personalized;
  final List<RecommendedServiceEntity> services;

  const ServiceRecommendationsEntity({
    required this.personalized,
    required this.services,
  });
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
    required this.description,
    required this.iconUrl,
    required this.coverImageUrl,
    required this.minPriceAmount,
    required this.maxPriceAmount,
    required this.currencyCode,
    required this.defaultDurationMinutes,
    required this.categoryName,
    required this.recommendationScore,
  });
}
