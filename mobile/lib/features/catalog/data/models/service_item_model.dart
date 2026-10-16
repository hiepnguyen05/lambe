import '../../domain/entities/service_item_entity.dart';

class ServiceCategorySummaryModel extends ServiceCategorySummaryEntity {
  const ServiceCategorySummaryModel({
    required super.id,
    required super.code,
    required super.name,
    required super.slug,
  });

  factory ServiceCategorySummaryModel.fromJson(Map<String, dynamic> json) {
    return ServiceCategorySummaryModel(
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
}

class ServiceItemModel extends ServiceItemEntity {
  const ServiceItemModel({
    required super.id,
    required super.code,
    required super.name,
    required super.slug,
    super.description,
    super.iconUrl,
    super.coverImageUrl,
    required super.minPriceAmount,
    required super.maxPriceAmount,
    super.currencyCode,
    super.defaultDurationMinutes,
    super.targetAudience,
    super.requiresCertificate,
    super.minExperienceYears,
    required super.category,
  });

  factory ServiceItemModel.fromJson(Map<String, dynamic> json) {
    final catJson = json['category'];
    final category = catJson is Map<String, dynamic>
        ? ServiceCategorySummaryModel.fromJson(catJson)
        : const ServiceCategorySummaryModel(
            id: '',
            code: '',
            name: '',
            slug: '',
          );

    return ServiceItemModel(
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
      minExperienceYears:
          (json['minExperienceYears'] as num?)?.toInt() ?? 0,
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
}
