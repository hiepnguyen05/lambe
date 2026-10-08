import '../../domain/entities/service_recommendations_entity.dart';

class ServiceRecommendationsModel {
  const ServiceRecommendationsModel._();

  static ServiceRecommendationsEntity fromJson(Map<String, dynamic> json) {
    final services = <RecommendedServiceEntity>[];
    final rawServices = json['services'];
    if (rawServices is List) {
      for (final item in rawServices) {
        if (item is! Map) continue;
        services.add(_serviceFromJson(Map<String, dynamic>.from(item)));
      }
    }

    return ServiceRecommendationsEntity(
      personalized: json['personalized'] == true,
      services: services,
    );
  }

  static RecommendedServiceEntity _serviceFromJson(Map<String, dynamic> json) {
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
