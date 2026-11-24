class ServiceCategoryOption {
  final String id, name;
  const ServiceCategoryOption({required this.id, required this.name});
}

class ServiceDefinition {
  final String id, name;
  final String? slug;
  final ServiceCategoryOption category;
  final int minPrice, maxPrice;
  final int? defaultDuration, minPortfolioImages, minExperienceYears;
  final bool? requiresCertificate;
  const ServiceDefinition({
    required this.id,
    required this.name,
    this.slug,
    required this.category,
    required this.minPrice,
    required this.maxPrice,
    this.defaultDuration,
    this.requiresCertificate,
    this.minPortfolioImages,
    this.minExperienceYears,
  });
}

class ProviderOffering {
  final String id, serviceId, status;
  final int price;
  final int? duration;
  final String? description, blockerCode, suspensionReason;
  final ServiceDefinition service;
  const ProviderOffering({
    required this.id,
    required this.serviceId,
    required this.status,
    required this.price,
    this.duration,
    this.description,
    this.blockerCode,
    this.suspensionReason,
    required this.service,
  });
  bool get active => status == 'ACTIVE';
  bool get suspended => status == 'SUSPENDED';
  bool get canToggle => !suspended && (active || blockerCode == null);
  int? get effectiveDuration => duration ?? service.defaultDuration;
}

String offeringBlockerLabel(String? code) => switch (code) {
  'SUSPENDED' => 'Dịch vụ bị đình chỉ. Cần bộ phận kiểm duyệt khôi phục.',
  'SERVICE_INACTIVE' => 'Dịch vụ trong danh mục hệ thống đang tạm khóa.',
  'CATEGORY_INACTIVE' => 'Danh mục của dịch vụ đang tạm khóa.',
  'PRICE_OUT_OF_RANGE' =>
    'Giá hiện tại nằm ngoài giá sàn/trần. Hãy gửi đề xuất điều chỉnh.',
  null => '',
  _ => 'Dịch vụ chưa đủ điều kiện. Vui lòng tải lại hoặc liên hệ hỗ trợ.',
};
