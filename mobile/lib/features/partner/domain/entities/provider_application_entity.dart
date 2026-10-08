enum PartnerApplicationStep { info, services, identity, expertise, submit }

class ProviderApplicationServiceRequirement {
  final String applicationServiceId;
  final String serviceId;
  final String name;
  final String status;
  final bool requiresCertificate;
  final int minPortfolioImages;
  final int minExperienceYears;

  const ProviderApplicationServiceRequirement({
    required this.applicationServiceId,
    required this.serviceId,
    required this.name,
    required this.status,
    required this.requiresCertificate,
    required this.minPortfolioImages,
    required this.minExperienceYears,
  });
}

class ProviderApplicationEntity {
  final String id;
  final String providerType; // INDIVIDUAL, ORGANIZATION
  final String? status;
  final String? submittedAt;
  final String? reviewedAt;
  final String? decisionReason;

  // Thông tin dùng chung
  final String? email;
  final String? biography;

  // Dành cho cá nhân (INDIVIDUAL)
  final String? legalFullName;
  final String? birthDate;
  final String? gender;
  final String? nationalIdNumber;
  final String? nationalIdMasked;
  final int? experienceYears;

  // Dành cho tổ chức (ORGANIZATION)
  final String? organizationName;
  final String? taxCode;
  final String? businessRegistrationNumber;
  final String? registeredAddress;
  final String? representativeName;
  final List<String> documentTypes;
  final int portfolioDocumentCount;
  final int certificateDocumentCount;
  final List<ProviderApplicationServiceRequirement> registeredServices;
  final int serviceCount;
  final int serviceSuggestionCount;
  final bool hasAcceptedTerms;
  final List<String> correctionSections;

  ProviderApplicationEntity({
    required this.id,
    required this.providerType,
    this.status,
    this.submittedAt,
    this.reviewedAt,
    this.decisionReason,
    this.email,
    this.biography,
    this.legalFullName,
    this.birthDate,
    this.gender,
    this.nationalIdNumber,
    this.nationalIdMasked,
    this.experienceYears,
    this.organizationName,
    this.taxCode,
    this.businessRegistrationNumber,
    this.registeredAddress,
    this.representativeName,
    this.documentTypes = const [],
    this.portfolioDocumentCount = 0,
    this.certificateDocumentCount = 0,
    this.registeredServices = const [],
    this.serviceCount = 0,
    this.serviceSuggestionCount = 0,
    this.hasAcceptedTerms = false,
    this.correctionSections = const [],
  });

  bool get isEditable => status == 'DRAFT' || status == 'NEEDS_CHANGES';

  bool get hasProfileInformation {
    if (email == null || email!.isEmpty) return false;
    if (providerType == 'ORGANIZATION') {
      return organizationName?.isNotEmpty == true &&
          businessRegistrationNumber?.isNotEmpty == true &&
          registeredAddress?.isNotEmpty == true &&
          representativeName?.isNotEmpty == true;
    }
    return legalFullName?.isNotEmpty == true &&
        birthDate?.isNotEmpty == true &&
        (nationalIdNumber?.isNotEmpty == true ||
            nationalIdMasked?.isNotEmpty == true) &&
        experienceYears != null;
  }

  bool get hasServices => serviceCount > 0 || serviceSuggestionCount > 0;

  bool get hasRequiredIdentityDocuments {
    final requiredTypes = providerType == 'ORGANIZATION'
        ? const {'PORTRAIT', 'BUSINESS_LICENSE'}
        : const {
            'PORTRAIT',
            'ID_CARD_FRONT',
            'ID_CARD_BACK',
            'IDENTITY_SELFIE',
          };
    return requiredTypes.every(documentTypes.contains);
  }

  Iterable<ProviderApplicationServiceRequirement>
  get activeServiceRequirements =>
      registeredServices.where((service) => service.status != 'REJECTED');

  bool get requiresProfessionalCertificate =>
      activeServiceRequirements.any((service) => service.requiresCertificate);

  int get requiredPortfolioImages => activeServiceRequirements.fold<int>(
    0,
    (required, service) => service.minPortfolioImages > required
        ? service.minPortfolioImages
        : required,
  );

  bool get hasRequiredProfessionalEvidence =>
      (!requiresProfessionalCertificate || certificateDocumentCount > 0) &&
      portfolioDocumentCount >= requiredPortfolioImages;

  bool get hasRequiredDocuments =>
      hasRequiredIdentityDocuments && hasRequiredProfessionalEvidence;

  PartnerApplicationStep get resumeStep {
    if (correctionSections.contains('IDENTITY')) {
      return PartnerApplicationStep.info;
    }
    if (correctionSections.contains('SERVICES')) {
      return PartnerApplicationStep.services;
    }
    if (correctionSections.contains('PORTRAIT')) {
      return PartnerApplicationStep.identity;
    }
    if (correctionSections.contains('EXPERTISE')) {
      return PartnerApplicationStep.expertise;
    }
    if (correctionSections.contains('TERMS')) {
      return PartnerApplicationStep.submit;
    }
    if (!hasProfileInformation) return PartnerApplicationStep.info;
    if (!hasServices) return PartnerApplicationStep.services;
    if (!hasRequiredIdentityDocuments) return PartnerApplicationStep.identity;
    if (!hasRequiredProfessionalEvidence) {
      return PartnerApplicationStep.expertise;
    }
    return PartnerApplicationStep.submit;
  }
}
