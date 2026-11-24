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
    category,
  ];
}
