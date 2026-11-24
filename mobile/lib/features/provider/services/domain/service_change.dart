import 'provider_offering.dart';

enum ServiceChangeType {
  addExisting('ADD_EXISTING_SERVICE', 'Thêm dịch vụ có sẵn'),
  updateOffering('UPDATE_OFFERING', 'Điều chỉnh dịch vụ của tôi'),
  proposeNew('PROPOSE_NEW_SERVICE', 'Đề xuất dịch vụ mới');

  final String wire, label;
  const ServiceChangeType(this.wire, this.label);
}

enum ServiceChangeStatus {
  draft('DRAFT', 'Bản nháp'),
  pending('PENDING_REVIEW', 'Chờ kiểm duyệt'),
  needsChanges('NEEDS_CHANGES', 'Cần bổ sung'),
  approved('APPROVED', 'Đã duyệt'),
  rejected('REJECTED', 'Đã từ chối'),
  withdrawn('WITHDRAWN', 'Đã rút');

  final String wire, label;
  const ServiceChangeStatus(this.wire, this.label);
}

class ServiceChangeDocument {
  final String id, type, status;
  const ServiceChangeDocument({
    required this.id,
    required this.type,
    required this.status,
  });
  String get label =>
      type == 'PROFESSIONAL_CERTIFICATE' ? 'Chứng chỉ nghề' : 'Ảnh sản phẩm';
}

class ServiceChange {
  final String id;
  final ServiceChangeType type;
  final ServiceChangeStatus status;
  final String? serviceId,
      offeringId,
      categoryId,
      proposedName,
      description,
      reviewNote;
  final int price;
  final int? duration;
  final DateTime updatedAt;
  final DateTime? submittedAt, reviewedAt;
  final ServiceDefinition? service;
  final ServiceCategoryOption? category;
  final List<ServiceChangeDocument> documents;
  const ServiceChange({
    required this.id,
    required this.type,
    required this.status,
    this.serviceId,
    this.offeringId,
    this.categoryId,
    this.proposedName,
    this.description,
    this.reviewNote,
    required this.price,
    this.duration,
    required this.updatedAt,
    this.submittedAt,
    this.reviewedAt,
    this.service,
    this.category,
    this.documents = const [],
  });
  String get name => proposedName ?? service?.name ?? 'Đề xuất dịch vụ';
  bool get editable =>
      status == ServiceChangeStatus.draft ||
      status == ServiceChangeStatus.needsChanges;
  bool get canWithdraw => editable || status == ServiceChangeStatus.pending;
}

class ServiceChangesPage {
  final List<ServiceChange> items;
  final int page, totalPages;
  const ServiceChangesPage(this.items, this.page, this.totalPages);
  bool get hasMore => page < totalPages;
}
