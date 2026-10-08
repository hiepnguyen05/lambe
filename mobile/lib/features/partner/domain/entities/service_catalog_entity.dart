class ServiceCatalogEntity {
  final String id;
  final String name;
  final String? categoryId;
  final String categoryName;
  final int? minPriceAmount;
  final int? maxPriceAmount;
  final int defaultDurationMinutes;
  final bool requiresCertificate;
  final int minPortfolioImages;
  final int minExperienceYears;

  const ServiceCatalogEntity({
    required this.id,
    required this.name,
    this.categoryId,
    required this.categoryName,
    this.minPriceAmount,
    this.maxPriceAmount,
    required this.defaultDurationMinutes,
    this.requiresCertificate = false,
    this.minPortfolioImages = 0,
    this.minExperienceYears = 0,
  });
}

class ProviderServiceInput {
  final String serviceId;
  final int proposedPriceAmount;
  final int durationMinutes;
  final String description;

  const ProviderServiceInput({
    required this.serviceId,
    required this.proposedPriceAmount,
    required this.durationMinutes,
    required this.description,
  });
}

class ServiceSuggestionInput {
  final String categoryId;
  final String name;
  final String? description;
  final int proposedPriceAmount;
  final int durationMinutes;

  const ServiceSuggestionInput({
    required this.categoryId,
    required this.name,
    this.description,
    required this.proposedPriceAmount,
    required this.durationMinutes,
  });
}
