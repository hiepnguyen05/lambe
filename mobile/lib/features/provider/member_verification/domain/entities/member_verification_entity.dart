class MemberVerificationOptionService {
  final String id; // ProviderService ID
  final String serviceCatalogId;
  final String name;
  final bool requiresCertificate;
  final int minExperienceYears;
  final int minPortfolioImages;

  const MemberVerificationOptionService({
    required this.id,
    required this.serviceCatalogId,
    required this.name,
    required this.requiresCertificate,
    required this.minExperienceYears,
    required this.minPortfolioImages,
  });

  factory MemberVerificationOptionService.fromJson(Map<String, dynamic> json) {
    final service = (json['service'] as Map?) ?? {};
    return MemberVerificationOptionService(
      id: json['id']?.toString() ?? '',
      serviceCatalogId: service['id']?.toString() ?? '',
      name: service['name']?.toString() ?? 'Dịch vụ',
      requiresCertificate: service['requiresCertificate'] == true,
      minExperienceYears: (service['minExperienceYears'] as num?)?.toInt() ?? 0,
      minPortfolioImages: (service['minPortfolioImages'] as num?)?.toInt() ?? 0,
    );
  }
}

class MemberVerificationDocumentEntity {
  final String id;
  final String type; // PORTRAIT, ID_CARD_FRONT, ID_CARD_BACK, IDENTITY_SELFIE, PROFESSIONAL_CERTIFICATE, PORTFOLIO
  final String? providerServiceId;
  final DateTime? expiresAt;
  final String status; // PENDING, VERIFIED, NEEDS_CHANGES, REJECTED
  final String? reviewNote;
  final DateTime? reviewedAt;
  final DateTime createdAt;

  const MemberVerificationDocumentEntity({
    required this.id,
    required this.type,
    this.providerServiceId,
    this.expiresAt,
    required this.status,
    this.reviewNote,
    this.reviewedAt,
    required this.createdAt,
  });

  bool get isVerified => status == 'VERIFIED';
  bool get needsChanges => status == 'NEEDS_CHANGES';
  bool get isRejected => status == 'REJECTED';

  factory MemberVerificationDocumentEntity.fromJson(Map<String, dynamic> json) {
    return MemberVerificationDocumentEntity(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      providerServiceId: json['providerServiceId']?.toString(),
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'].toString())
          : null,
      status: json['status']?.toString() ?? 'PENDING',
      reviewNote: json['reviewNote']?.toString(),
      reviewedAt: json['reviewedAt'] != null
          ? DateTime.tryParse(json['reviewedAt'].toString())
          : null,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class MemberVerificationProfileEntity {
  final String id;
  final String memberId;
  final int membershipVersion;
  final String status; // DRAFT, PENDING_REVIEW, NEEDS_CHANGES, APPROVED, REJECTED
  final int revisionNumber;
  final String? legalFullName;
  final String? birthDate;
  final String? gender;
  final int? experienceYears;
  final String? nationalIdMasked;
  final List<String> requestedProviderServiceIds;
  final String? termsVersion;
  final DateTime? termsAcceptedAt;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;
  final String? decisionReason;
  final List<MemberVerificationDocumentEntity> documents;

  const MemberVerificationProfileEntity({
    required this.id,
    required this.memberId,
    required this.membershipVersion,
    required this.status,
    required this.revisionNumber,
    this.legalFullName,
    this.birthDate,
    this.gender,
    this.experienceYears,
    this.nationalIdMasked,
    this.requestedProviderServiceIds = const [],
    this.termsVersion,
    this.termsAcceptedAt,
    this.submittedAt,
    this.reviewedAt,
    this.decisionReason,
    this.documents = const [],
  });

  bool get isEditable => status == 'DRAFT' || status == 'NEEDS_CHANGES';
  bool get isApproved => status == 'APPROVED';
  bool get isPendingReview => status == 'PENDING_REVIEW';
  bool get needsChanges => status == 'NEEDS_CHANGES';

  factory MemberVerificationProfileEntity.fromJson(Map<String, dynamic> json) {
    final docsList = (json['documents'] as List<dynamic>?) ?? [];
    return MemberVerificationProfileEntity(
      id: json['id']?.toString() ?? '',
      memberId: json['memberId']?.toString() ?? '',
      membershipVersion: (json['membershipVersion'] as num?)?.toInt() ?? 1,
      status: json['status']?.toString() ?? 'DRAFT',
      revisionNumber: (json['revisionNumber'] as num?)?.toInt() ?? 1,
      legalFullName: json['legalFullName']?.toString(),
      birthDate: json['birthDate']?.toString(),
      gender: json['gender']?.toString(),
      experienceYears: (json['experienceYears'] as num?)?.toInt(),
      nationalIdMasked: json['nationalIdMasked']?.toString(),
      requestedProviderServiceIds:
          (json['requestedProviderServiceIds'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              const [],
      termsVersion: json['termsVersion']?.toString(),
      termsAcceptedAt: json['termsAcceptedAt'] != null
          ? DateTime.tryParse(json['termsAcceptedAt'].toString())
          : null,
      submittedAt: json['submittedAt'] != null
          ? DateTime.tryParse(json['submittedAt'].toString())
          : null,
      reviewedAt: json['reviewedAt'] != null
          ? DateTime.tryParse(json['reviewedAt'].toString())
          : null,
      decisionReason: json['decisionReason']?.toString(),
      documents: docsList
          .map((d) => MemberVerificationDocumentEntity.fromJson(
              Map<String, dynamic>.from(d as Map)))
          .toList(),
    );
  }
}
