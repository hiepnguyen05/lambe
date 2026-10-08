import '../../domain/entities/provider_application_entity.dart';
import '../../domain/entities/provider_application_update.dart';
import '../../domain/entities/service_catalog_entity.dart';

class PartnerApiModel {
  const PartnerApiModel._();

  static ProviderApplicationEntity applicationFromJson(
    Map<String, dynamic> json,
  ) {
    final documents =
        _listOfMaps(json['documents']) ?? const <Map<String, dynamic>>[];
    final services = _listOfMaps(json['services']);
    final suggestions = _listOfMaps(json['serviceSuggestions']);
    final terms =
        _listOfMaps(json['termsAcceptances']) ?? const <Map<String, dynamic>>[];
    final checks =
        _listOfMaps(json['checks']) ?? const <Map<String, dynamic>>[];
    final rawCount = json['_count'];
    final count = rawCount is Map
        ? Map<String, dynamic>.from(rawCount)
        : const <String, dynamic>{};
    final rawBirthDate = json['birthDate'] as String?;
    final acceptedDocuments = documents
        .where((item) => item['status'] != 'REJECTED')
        .toList(growable: false);
    final registeredServices = (services ?? const <Map<String, dynamic>>[])
        .map((item) {
          final rawService = item['service'];
          final service = rawService is Map
              ? Map<String, dynamic>.from(rawService)
              : const <String, dynamic>{};
          return ProviderApplicationServiceRequirement(
            applicationServiceId: item['id']?.toString() ?? '',
            serviceId:
                item['serviceId']?.toString() ??
                service['id']?.toString() ??
                '',
            name: service['name']?.toString() ?? 'Dịch vụ',
            status: item['status']?.toString() ?? 'PENDING',
            requiresCertificate: service['requiresCertificate'] == true,
            minPortfolioImages:
                (service['minPortfolioImages'] as num?)?.toInt() ?? 0,
            minExperienceYears:
                (service['minExperienceYears'] as num?)?.toInt() ?? 0,
          );
        })
        .toList(growable: false);
    return ProviderApplicationEntity(
      id: json['id'] as String,
      providerType: json['providerType'] as String,
      status: json['status'] as String?,
      submittedAt: json['submittedAt'] as String?,
      reviewedAt: json['reviewedAt'] as String?,
      decisionReason: json['decisionReason'] as String?,
      email: json['email'] as String?,
      biography: json['biography'] as String?,
      legalFullName: json['legalFullName'] as String?,
      birthDate: rawBirthDate == null || rawBirthDate.length < 10
          ? rawBirthDate
          : rawBirthDate.substring(0, 10),
      gender: json['gender'] as String?,
      nationalIdNumber: json['nationalIdNumber'] as String?,
      nationalIdMasked: json['nationalIdMasked'] as String?,
      experienceYears: (json['experienceYears'] as num?)?.toInt(),
      organizationName: json['organizationName'] as String?,
      taxCode: json['taxCode'] as String?,
      businessRegistrationNumber: json['businessRegistrationNumber'] as String?,
      registeredAddress: json['registeredAddress'] as String?,
      representativeName: json['representativeName'] as String?,
      documentTypes: acceptedDocuments
          .map((item) => item['type']?.toString())
          .whereType<String>()
          .toList(growable: false),
      portfolioDocumentCount: acceptedDocuments
          .where((item) => item['type'] == 'PORTFOLIO')
          .length,
      certificateDocumentCount: acceptedDocuments
          .where((item) => item['type'] == 'PROFESSIONAL_CERTIFICATE')
          .length,
      registeredServices: registeredServices,
      serviceCount:
          services?.length ?? (count['services'] as num?)?.toInt() ?? 0,
      serviceSuggestionCount:
          suggestions?.length ??
          (count['serviceSuggestions'] as num?)?.toInt() ??
          0,
      hasAcceptedTerms: terms.isNotEmpty,
      correctionSections: checks
          .where(
            (item) =>
                item['status'] == 'NEEDS_CHANGES' ||
                item['status'] == 'REJECTED',
          )
          .map((item) => item['section']?.toString())
          .whereType<String>()
          .toList(growable: false),
    );
  }

  static List<Map<String, dynamic>>? _listOfMaps(dynamic raw) {
    if (raw is! List) return null;
    return raw
        .whereType<Map>()
        .map(Map<String, dynamic>.from)
        .toList(growable: false);
  }

  static ServiceCatalogEntity serviceFromJson(Map<String, dynamic> json) {
    final rawCategory = json['category'];
    final category = rawCategory is Map
        ? Map<String, dynamic>.from(rawCategory)
        : const <String, dynamic>{};
    return ServiceCatalogEntity(
      id: json['id'] as String,
      name: json['name'] as String,
      categoryId: category['id'] as String?,
      categoryName: category['name'] as String? ?? 'Khác',
      minPriceAmount: (json['minPriceAmount'] as num?)?.toInt(),
      maxPriceAmount: (json['maxPriceAmount'] as num?)?.toInt(),
      defaultDurationMinutes:
          (json['defaultDurationMinutes'] as num?)?.toInt() ?? 30,
      requiresCertificate: json['requiresCertificate'] == true,
      minPortfolioImages: (json['minPortfolioImages'] as num?)?.toInt() ?? 0,
      minExperienceYears: (json['minExperienceYears'] as num?)?.toInt() ?? 0,
    );
  }

  static Map<String, dynamic> applicationUpdateToJson(
    ProviderApplicationUpdate update,
  ) {
    return {
      'email': update.email,
      'biography': update.biography,
      if (update.legalFullName != null) 'legalFullName': update.legalFullName,
      if (update.birthDate != null) 'birthDate': update.birthDate,
      if (update.gender != null) 'gender': update.gender,
      if (update.nationalIdNumber != null)
        'nationalIdNumber': update.nationalIdNumber,
      if (update.experienceYears != null)
        'experienceYears': update.experienceYears,
      if (update.organizationName != null)
        'organizationName': update.organizationName,
      if (update.taxCode != null) 'taxCode': update.taxCode,
      if (update.businessRegistrationNumber != null)
        'businessRegistrationNumber': update.businessRegistrationNumber,
      if (update.registeredAddress != null)
        'registeredAddress': update.registeredAddress,
      if (update.representativeName != null)
        'representativeName': update.representativeName,
    };
  }

  static Map<String, dynamic> providerServiceToJson(
    ProviderServiceInput input,
  ) {
    return {
      'serviceId': input.serviceId,
      'proposedPriceAmount': input.proposedPriceAmount,
      'durationMinutes': input.durationMinutes,
      'description': input.description,
    };
  }

  static Map<String, dynamic> serviceSuggestionToJson(
    ServiceSuggestionInput input,
  ) {
    return {
      'categoryId': input.categoryId,
      'name': input.name,
      if (input.description != null) 'description': input.description,
      'proposedPriceAmount': input.proposedPriceAmount,
      'durationMinutes': input.durationMinutes,
    };
  }
}
