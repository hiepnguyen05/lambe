class PartnerProfileEntity {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String biography;
  final String serviceAreaName;
  final int serviceRadiusKm;
  final int activeServicesCount;
  final String servicesSummary;
  final String workingHoursSummary;
  final int? completedBookings;
  final double? acceptanceRate;
  final double? onTimeRate;
  final double? rating;
  final int? reviewCount;
  final bool isVerified;
  final bool isDispatchEnabled;
  final int? portfolioPhotosCount;
  final int? certificatesCount;
  final String providerType;
  final bool acceptingMemberOrders;

  bool get isOrganization => providerType == 'ORGANIZATION';
  bool get isIndividual => providerType != 'ORGANIZATION';

  const PartnerProfileEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.biography = '',
    this.serviceAreaName = 'Chưa thiết lập',
    this.serviceRadiusKm = 0,
    this.activeServicesCount = 0,
    this.servicesSummary = 'Chưa có dịch vụ hoạt động',
    this.workingHoursSummary = 'Chưa thiết lập lịch làm việc',
    this.completedBookings,
    this.acceptanceRate,
    this.onTimeRate,
    this.rating,
    this.reviewCount,
    this.isVerified = false,
    this.isDispatchEnabled = false,
    this.portfolioPhotosCount,
    this.certificatesCount,
    this.providerType = 'INDIVIDUAL',
    this.acceptingMemberOrders = true,
  });

  PartnerProfileEntity copyWith({
    String? id,
    String? displayName,
    String? avatarUrl,
    String? biography,
    String? serviceAreaName,
    int? serviceRadiusKm,
    int? activeServicesCount,
    String? servicesSummary,
    String? workingHoursSummary,
    int? completedBookings,
    double? acceptanceRate,
    double? onTimeRate,
    double? rating,
    int? reviewCount,
    bool? isVerified,
    bool? isDispatchEnabled,
    int? portfolioPhotosCount,
    int? certificatesCount,
    String? providerType,
    bool? acceptingMemberOrders,
  }) {
    return PartnerProfileEntity(
      id: id ?? this.id,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      biography: biography ?? this.biography,
      serviceAreaName: serviceAreaName ?? this.serviceAreaName,
      serviceRadiusKm: serviceRadiusKm ?? this.serviceRadiusKm,
      activeServicesCount: activeServicesCount ?? this.activeServicesCount,
      servicesSummary: servicesSummary ?? this.servicesSummary,
      workingHoursSummary: workingHoursSummary ?? this.workingHoursSummary,
      completedBookings: completedBookings ?? this.completedBookings,
      acceptanceRate: acceptanceRate ?? this.acceptanceRate,
      onTimeRate: onTimeRate ?? this.onTimeRate,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      isVerified: isVerified ?? this.isVerified,
      isDispatchEnabled: isDispatchEnabled ?? this.isDispatchEnabled,
      portfolioPhotosCount: portfolioPhotosCount ?? this.portfolioPhotosCount,
      certificatesCount: certificatesCount ?? this.certificatesCount,
      providerType: providerType ?? this.providerType,
      acceptingMemberOrders:
          acceptingMemberOrders ?? this.acceptingMemberOrders,
    );
  }
}
