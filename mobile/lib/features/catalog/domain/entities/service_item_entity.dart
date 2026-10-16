import 'package:equatable/equatable.dart';

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
    required this.category,
  });

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
        category,
      ];
}
