import '../domain/provider_offering.dart';
import '../domain/service_change.dart';
import '../domain/service_change_draft.dart';

Map<String, dynamic> objectMap(Object? value) =>
    Map<String, dynamic>.from(value as Map);
String _string(Object? value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Thiếu thông tin dịch vụ.');
  }
  return value;
}

int _integer(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Thông tin giá/thời lượng không hợp lệ.');
  }
  return value;
}

ServiceCategoryOption categoryFromJson(Map<String, dynamic> json) =>
    ServiceCategoryOption(id: _string(json['id']), name: _string(json['name']));
ServiceDefinition definitionFromJson(Map<String, dynamic> json) {
  final min = _integer(json['minPriceAmount']),
      max = _integer(json['maxPriceAmount']);
  if (min > max) throw const FormatException('Khoảng giá không hợp lệ.');
  return ServiceDefinition(
    id: _string(json['id']),
    name: _string(json['name']),
    slug: json['slug'] as String?,
    category: categoryFromJson(objectMap(json['category'])),
    minPrice: min,
    maxPrice: max,
    defaultDuration: json['defaultDurationMinutes'] == null
        ? null
        : _integer(json['defaultDurationMinutes']),
    requiresCertificate: json['requiresCertificate'] as bool?,
    minPortfolioImages: json['minPortfolioImages'] as int?,
    minExperienceYears: json['minExperienceYears'] as int?,
  );
}

ProviderOffering offeringFromJson(Map<String, dynamic> json) {
  final service = definitionFromJson(objectMap(json['service']));
  if (!const {'ACTIVE', 'INACTIVE', 'SUSPENDED'}.contains(json['status']) ||
      json['serviceId'] != service.id) {
    throw const FormatException('Trạng thái hoặc dịch vụ không khớp.');
  }
  return ProviderOffering(
    id: _string(json['id']),
    serviceId: _string(json['serviceId']),
    status: _string(json['status']),
    price: _integer(json['priceAmount']),
    duration: json['durationMinutes'] as int?,
    description: json['description'] as String?,
    suspensionReason: json['suspensionReason'] as String?,
    blockerCode: json['blockerCode'] as String?,
    service: service,
  );
}

ServiceChangeDocument documentFromJson(Map<String, dynamic> json) =>
    ServiceChangeDocument(
      id: _string(json['id']),
      type: _string(json['type']),
      status: _string(json['status']),
    );
ServiceChange changeFromJson(Map<String, dynamic> json) => ServiceChange(
  id: _string(json['id']),
  type: ServiceChangeType.values.singleWhere((v) => v.wire == json['type']),
  status: ServiceChangeStatus.values.singleWhere(
    (v) => v.wire == json['status'],
  ),
  serviceId: json['serviceId'] as String?,
  offeringId: json['providerServiceId'] as String?,
  categoryId: json['categoryId'] as String?,
  proposedName: json['proposedName'] as String?,
  price: _integer(json['proposedPriceAmount']),
  duration: json['proposedDurationMinutes'] as int?,
  description: json['proposedDescription'] as String?,
  reviewNote: json['reviewNote'] as String?,
  updatedAt: DateTime.parse(_string(json['updatedAt'])).toUtc(),
  submittedAt: json['submittedAt'] == null
      ? null
      : DateTime.parse(json['submittedAt'] as String).toUtc(),
  reviewedAt: json['reviewedAt'] == null
      ? null
      : DateTime.parse(json['reviewedAt'] as String).toUtc(),
  service: json['service'] == null
      ? null
      : definitionFromJson(objectMap(json['service'])),
  category: json['category'] == null
      ? null
      : categoryFromJson(objectMap(json['category'])),
  documents: (json['documents'] as List? ?? [])
      .map((v) => documentFromJson(objectMap(v)))
      .toList(growable: false),
);
Map<String, dynamic> draftToJson(
  ServiceChangeDraft value, {
  bool creating = false,
}) => {
  if (creating) ...{
    'type': value.type.wire,
    if (value.type == ServiceChangeType.addExisting)
      'serviceId': value.serviceId,
    if (value.type == ServiceChangeType.updateOffering)
      'providerServiceId': value.offeringId,
  },
  if (value.type == ServiceChangeType.proposeNew) ...{
    'categoryId': value.categoryId,
    'name': value.name!.trim(),
  },
  'proposedPriceAmount': value.price,
  'proposedDurationMinutes': value.duration,
  'proposedDescription': value.description?.trim().isNotEmpty == true
      ? value.description!.trim()
      : null,
};
